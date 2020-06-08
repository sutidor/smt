/**
 * MODE: Followmode_competitor_followers
 * =====================
 * Select account, get random followers and follows it for a while
 *
 * TODO: like random photos and sleep 15-20min.
 *
 * @author:     The Louie [@the_louie] <oss@louie.se>
 * @license:    This code and contributions have 'GNU General Public License v3'
 *
 */
const ManagerState = require('../common/state').Manager_state
const sqlite3 = require('sqlite3').verbose()

const ssm = () => ((new Date()).getHours() * 3600) + ((new Date()).getMinutes() * 60) + ((new Date()).getSeconds())

const fdfCases = {
  '-1': 'defollow',
  0: 'nop',
  1: 'follow'
}

const unique = arr => arr.reduce((acc, curr) => acc.concat((acc.indexOf(curr) === -1) ? [curr] : []), [])

function dateStr (dateObj) {
  if (dateObj === undefined) {
    dateObj = new Date()
  }
  return new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().replace(/\.[0-9]{3}Z$/, '').replace('T', ' ')
}

/* eslint-disable-next-line camelcase */
class Followmode_competitor_followers extends ManagerState { // Needs to be in camelcase to work with the engine
  constructor (bot, config, utils) {
    super()
    this.bot = bot
    this.config = config
    this.utils = utils
    this.STATE = require('../common/state').STATE
    this.STATE_EVENTS = require('../common/state').EVENTS
    this.Log = require('../logger/log')
    this.LOG_NAME = 'comp-follow'
    this.log = new this.Log(this.LOG_NAME, this.config)
    this.db = new sqlite3.Database('./databases/fdfcmode.db')
    this.account = this.config.instagram_username
    this.competitors = this.config.competitors
    this.cacheCompetitorFollowers = []
    this.dailyFollows = this.config.bot_max_daily_follows
    // this.follow_target = this.config.bot_target_follow_count
    this.currentCycleActionCount = 0
    // this.totalLikecount = 0
    // this.randomize_times = this.config.bot_randomize_times
    this.startDay = this.config.bot_start_day
    this.endDay = this.config.bot_end_day
    this.cycleDownTime = this.config.bot_cycle_down_time

    this.cycleFollows = 0
    this.cycleDefollows = 0
    this.totalFollows = 0
    this.totalDefollows = 0
    //
    this.errorCount = 0
  }

  async initDB () {
    const self = this

    await this.db.serialize(async function () {
      self.db.run('CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, username VARCHAR(64) UNIQUE, active BOOL DEFAULT true)', (err) => {
        if (err) {
          self.log.error(`initDB.accounts: ${err}`)
        }
      })
      self.db.run('CREATE TABLE IF NOT EXISTS competitors (id INTEGER PRIMARY KEY AUTOINCREMENT, account VARCHAR(64), username VARCHAR(64), points INTEGER DEFAULT 0, blacklisted BOOL DEFAULT false, inserted_at DATETIME DEFAULT CURRENT_TIMESTAMP)', function (err) {
        if (err) {
          self.log.error(`initDB.competitors: ${err}`)
        }
      })
      self.db.run('CREATE TABLE IF NOT EXISTS followers (id INTEGER PRIMARY KEY AUTOINCREMENT, account VARCHAR(64), username TEXT, curr_state VARCHAR(16), parent INTEGER, points INTEGER DEFAULT 0, blacklisted BOOL DEFAULT false, inserted_at DATETIME DEFAULT CURRENT_TIMESTAMP)', function (err) {
        if (err) {
          self.log.error(`initDB.followers: ${err}`)
        }
      })
      self.db.run('CREATE TABLE IF NOT EXISTS actions (id INTEGER PRIMARY KEY AUTOINCREMENT, account VARCHAR(64), username TEXT, state_to VARCHAR(16), inserted_at DATETIME DEFAULT CURRENT_TIMESTAMP)', function (err) {
        if (err) {
          self.log.error(`initDB.actions: ${err}`)
        }
      })
    })
  }

  dbFollowerExists (username) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare('SELECT COUNT(*) as c FROM followers WHERE username LIKE ?')
      stmt.get([username], (err, row) => {
        if (err) {
          this.log.error(`Error when checking if follower exists '${username}`)
          reject(Error(err))
        }
        resolve(row.c && row.c > 0)
      })
    })
  }

  dbGetFollowers () {
    return new Promise((resolve) => {
      this.log.debug('dbGetFollowers()')
      this.db.all('SELECT username FROM followers', (err, rows) => {
        if (err) {
          this.log.error(`Error when retrieving followers from database: ${err}`)
          return resolve([])
        }
        return resolve(rows.map(row => row.username))
      })
    })
  }

  dbInsertPromise (query, args) {
    return new Promise((resolve) => {
      this.db.run(query, args, (err, res) => {
        if (err) {
          this.log.error(`dbInsertPromise(): ${err}`)
          this.log.debug(`dbInsertPromise(${query}, ${args})`)
          return resolve()
        }
        return resolve(res)
      })
    })
  }

  /**
      * @param {string} usernames - Usernames of the follower to add
      * @param {string} parentUsername - Username of the parent account where the follower was found
      * @return {Promise<void>}
      */
  dbAddFolowers (usernames, parentUsername) {
    return new Promise((resolve) => {
      this.log.debug(`dbAddFolowers(#${usernames.length}, ${parentUsername})`)
      this.dbGetFollowers()
        .then((existingFollowers) => {
          this.log.debug(`after dbGetFollowers, found ${existingFollowers.length} existing followers`)
          const uniqueUsernames = usernames.filter(username => !existingFollowers.includes(username))
          this.log.debug(`after removing existing for usernames we have ${uniqueUsernames.length} remaining`)
          const dbInsertPromises = uniqueUsernames.map((username) => this.dbInsertPromise('INSERT INTO followers (account, username, parent) VALUES (?,?,?)', [this.account, username, parentUsername]))
          this.log.debug(`we got ${dbInsertPromises.length} promises to resolve`)
          Promise.allSettled(dbInsertPromises)
            .then(() => {
              this.log.debug('All promises are resolved or settled')
              resolve()
            })
        })
    })
  }

  // dbGetFreshFolowers() {
  //     return new Promise((resolve, reject) => {
  //         this.log.debug('dbGetFreshFolowers()')
  //         const stmt = this.db.prepare(`SELECT username FROM followers WHERE account=? AND curr_state != 'following'`)
  //         stmt.all([this.account], (err, rows) => {
  //             if (err) {
  //                 this.log.error(`Error when getting fresh followers for '${this.account}: ${err}`)
  //                 return resolve([])
  //             }
  //             stmt.finalize()
  //             this.log.debug(`found followers: ${rows.join(' ')}`)
  //             return resolve(rows)
  //         })
  //     })
  // }

  dbGetFreshFolowers () {
    return new Promise((resolve) => {
      this.log.debug('dbGetFreshFolowers()')
      this.db.all('SELECT username FROM followers WHERE curr_state is null or curr_state != \'following\'', (err, rows) => {
        if (err) {
          this.log.error(`Error when retrieving followers from database: ${err}`)
          return resolve([])
        }
        this.log.debug(`Returned ${rows.length} rows.`)
        return resolve(rows.map(row => row.username))
      })
    })
  }

  /**
   * returrns follower that been followed for more than 7 days
   */
  dbGetFollowedFollower () {
    return new Promise((resolve) => {
      this.log.debug('dbGetFollowedFollower()')
      this.db.all('SELECT a.username  FROM followers a left join actions b on a.username=b.username WHERE curr_state is not null and curr_state = \'following\' and (julianday(\'now\') - julianday(b.inserted_at)) > 7 order by random() limit 1', (err, rows) => {
        if (err) {
          this.log.error(`Error when retrieving followers from database: ${err}`)
          return resolve()
        }
        this.log.debug(`Returned ${rows.length} rows.`)
        return resolve(rows.map(row => row.username))
      })
    })
  }

  /**
     * Open random competitor account page
     * @param {string} username - Username of the follower to add
     * @param {string} newStatus - New status for the username
     * @return {Promise<void>}
     */
  dbUpdateStatus (username, newStatus) {
    return new Promise((resolve) => {
      this.db.serialize(async () => {
        this.db.run('INSERT INTO actions (account, username, state_to) VALUES (?, ?, ?)', [this.account, username, newStatus], (err) => {
          if (err) {
            this.log.error(`Error when adding action for '${username}' to '${newStatus}: ${err}`)
            return resolve(false)
          }
        })

        this.db.run('UPDATE followers SET curr_state = ? WHERE username = ?', [newStatus, username], (err) => {
          if (err) {
            this.log.error(`Error when updating status for '${username}' to '${newStatus}: ${err}`)
            return resolve(false)
          }
        })
      })
      resolve(true)
    })
  }

  /**
     * Open random competitor account page
     * @return {Promise<void>}
     */
  async openRandomCompetitorPage () {
    const account = this.competitors[Math.floor(Math.random() * this.competitors.length)]
    const accountUrl = `https://www.instagram.com/${account}`
    this.log.debug(`Opening competitor account ${account}`)

    try {
      await this.bot.goto(accountUrl)
    } catch (err) {
      this.log.error(`goto ${err}`)
      this.log.debug(err.stack)
      return
    }

    await this.utils.sleep(this.utils.random_interval(3, 6))
    await this.utils.screenshot(this.LOG_NAME, 'account_page')
    return account
  }

  /**
     * Get follower url from cache
     *
     * @return {string} url
     */
  getRandomFollowerFromCache () {
    // FIXME: do not remove but tag with timestamp that we can clear after a sertan time
    let followerUsername = ''
    do {
      followerUsername = this.cacheCompetitorFollowers.pop()
    } while ((typeof followerUsername === 'undefined' || followerUsername.indexOf('www.instagram.com') === -1) && this.cacheCompetitorFollowers.length > 0)
    return followerUsername
  }

  /**
     * Get image url from cache
     * @return {string} url
     */
  // get_random_image_url_from_cache () {
  //     // let image_url = "";
  //     do {
  //         const image_url = this.cache_target_images.pop();
  //     } while ((typeof image_url === "undefined" || image_url.indexOf("www.instagram.com") === -1) && this.cache_target_images.length > 0);
  //     return image_url;
  // }
  /**
     * Scroll followers
     * @return {Promise<Promise<*>|Promise<Object>|*|XPathResult>} Promise
     */
  async scrollFollowers () {
    this.log.debug('scroll action')
    return this.bot.evaluate(() => {
      return new Promise((resolve) => {
        let counter = 3 + (Math.random() * 5)
        const timer = setInterval(() => {
          document.querySelector('div[role="dialog"] div:nth-child(2)').scrollBy(0, 4000 + (Math.random() * 4000))
          if (counter <= 0) {
            clearInterval(timer)
            resolve()
          } else {
            counter--
          }
        }, 4000 + (Math.random() * 2000))
      })
    })
  }

  /**
     * Open page follower and remove from cache
     * @param {string} username Username to open profile for
     * @return {Promise<void>}
     */
  async openUsernamePage (username) {
    if (username === undefined) {
      return false
    }

    this.log.debug(`openUsernamePage(): username '${username}'`)
    const userUrl = `https://instagram.com/${username}`
    await this.utils.sleep(this.utils.random_interval(3, 6))

    try {
      await this.bot.goto(userUrl)
      this.errorCount = 0
    } catch (err) {
      this.log.error(`openUsernamePage '${username}': ${err}`)
      this.log.debug(err.stack)
      this.errorCount += 1
      return false
    }
    await this.utils.sleep(this.utils.random_interval(3, 6))

    if (await this.userIsPrivate()) {
      this.dbUpdateStatus(username, 'private')
      return false
    }

    return true
  }

  /**
     * Get random image from current user
     * @return {Boolean}
     */
  // async get_random_user_images_url () {
  //     while (this.cacheCompetitorFollowers.length > 0) {
  //         await this.openUsernamePage();
  //         await this.utils.sleep(this.utils.random_interval(3, 6));

  //         // get a random pic from user and goto that url
  //         try {
  //             let images_url = await this.bot.$$eval("article>div div div div a", hrefs => hrefs.map((a) => {
  //                 return a.href;
  //             }));
  //             this.log.debug(`images_url-array: ${images_url.join(" ")}`);
  //             if (images_url.length === 0) {
  //                 this.log.error(`No images_url found for current user`);
  //                 return false;
  //             } else {
  //                 this.cache_target_images += images_url.slice(0, 5); // focus on the 5 latest images
  //                 return true;
  //             }

  //         } catch (err) {
  //             if (this.utils.is_debug()) {
  //                 this.log.debug(`get_random_user_images_url(): ${err}`);
  //             }
  //             return false;
  //         }
  //     }
  // }
  /**
     * @param {string} parentUsername username of account to check followers for
     * @return {Promise<void>}
     */
  async getFollowersForUser (parentUsername) {
    this.log.debug(`getFollowersForUser(${parentUsername})`)
    try {
      const selectorFollowersCounter = 'main header section ul li:nth-child(2) a'
      await this.bot.waitForSelector(selectorFollowersCounter, { timeout: 5000 })
      const areaCountFollowers = await this.bot.$(selectorFollowersCounter)
      await areaCountFollowers.click()
      // scroll
      await this.scrollFollowers(this.bot)
      this.errorCount -= 1
    } catch (err) {
      this.log.error(`Exception when looking for followers for ${parentUsername}`)
      this.log.debug(err.stack)
      this.errorCount += 1
      return
    }

    try {
      const cacheCompetitorFollowers = unique((await this.bot.$$eval('div[role="dialog"] ul li a', hrefs => hrefs.map((a) => {
        return a.href
      }))).map(userUrl => userUrl.replace(/^https?:\/\/.*?instagram.com\//, '').replace(/\/*$/, '')))

      await this.dbAddFolowers(cacheCompetitorFollowers, parentUsername)
      this.cacheCompetitorFollowers = this.cacheCompetitorFollowers.concat(cacheCompetitorFollowers)
      this.cacheCompetitorFollowers = unique(this.cacheCompetitorFollowers) // only need one of each

      await this.utils.sleep(this.utils.random_interval(10, 15))

      this.log.debug(`this.cacheCompetitorFollowers.length = ${this.cacheCompetitorFollowers.length}`)
      this.errorCount -= 1
      return cacheCompetitorFollowers.length
    } catch (err) {
      this.log.error(`get url followers error ${err}`)
      this.log.debug(err.stack)
      await this.utils.screenshot(this.LOG_NAME, 'get_url_followers_error')
      this.errorCount += 1
    }
  }

  async defollowDebug (selector) {
    /* defollow-button debugging */
    try {
      this.log.debug(`--- ${selector} --------`)
      await this.bot.waitForSelector(selector, { timeout: 5000 })
      this.log.debug(`button after $(): ${await this.bot.$(selector)}`)
      const element = await this.bot.evaluate(el => el, await this.bot.$(selector))
      this.log.debug(`element: ${element}`)
      const attributes = await this.bot.evaluate(el => el.attributes, await this.bot.$(selector))
      this.log.debug(`attributes: ${attributes}`)
      const innerHTML = await this.bot.evaluate(el => el.innerHTML, await this.bot.$(selector))
      this.log.debug(`innerHTML: ${innerHTML}`)
      const innerText = await this.bot.evaluate(el => el.innerText, await this.bot.$(selector))
      this.log.debug(`innerText: ${innerText}`)
    } catch (err) {
      this.log.error(err.stack)
    } finally {
      this.log('--- end.')
    }
  }

  /**
     * followRandomFollower
     * =====================
     * Click on follow and verify if instagram not (soft) ban you
     *
     */
  async followRandomFollower () {
    this.log.debug('try follow a random follower')

    let username
    this.log.debug('Searching for follower to open...')
    while (username === undefined || !(await this.openUsernamePage(username))) {
      username = this.cacheCompetitorFollowers[Math.floor(Math.random() * this.cacheCompetitorFollowers.length)]
      // this.log.debug(`this.cacheCompetitorFollowers: ${this.cacheCompetitorFollowers}`)
      this.cacheCompetitorFollowers.splice(this.cacheCompetitorFollowers.indexOf(username), 1)
      this.utils.sleep(this.utils.random_interval(4, 7))
    }

    if (username === undefined) {
      return
    }
    this.log.debug(`Found user to try to follow: '${username}.`)

    let button
    let buttonBeforeClick
    try {
      const buttonBeforeSelector = 'main header span button'
      await this.bot.waitForSelector(buttonBeforeSelector, { timeout: 5000 + (Math.random() * 5000) })
      button = await this.bot.$(buttonBeforeSelector)
      buttonBeforeClick = await this.bot.evaluate(el => el.innerHTML, await this.bot.$(buttonBeforeSelector))
      this.log.debug(`f button text before click: ${buttonBeforeClick}`)
      this.errorCount -= 1
    } catch (err) {
      this.log.warning('Error when trying to find follow-button')
      this.log.debug(err.stack)
      this.dbUpdateStatus(username, `error: ${err}`)
      await this.utils.screenshot(this.LOG_NAME, 'follow-find-follow-button')
      this.errorCount += 1
      return false
    }
    try {
      await button.click()
      this.errorCount -= 1
    } catch (err) {
      this.log.warning('Error when trying to click follow')
      this.log.debug(err.stack)
      this.dbUpdateStatus(username, `error: ${err}`)
      await this.utils.screenshot(this.LOG_NAME, 'follow-click-follow-button')
      this.errorCount += 1
      return false
    }
    try {
      const defollowButtonSelector = '#react-root > section > main > div > header > section > div > div > span > span > button > div > span[aria-label="Following"]'
      await this.utils.sleep(this.utils.random_interval(2, 3))
      await this.bot.waitForSelector(defollowButtonSelector, { timeout: 5000 })
      const ariaLabel = await this.bot.evaluate(el => (el.attributes['aria-label'] && el.attributes['aria-label'].value), await this.bot.$(defollowButtonSelector))
      this.log.debug(`attrs: ${JSON.stringify(ariaLabel)}`)

      if (ariaLabel.toLocaleLowerCase() === 'following') {
        this.log.info(`Now following '${username}'`)
        this.dbUpdateStatus(username, 'following')
        this.currentCycleActionCount += 1
        this.cycleFollows += 1
        this.totalFollows += 1
      } else {
        this.log.warning('follow failed')
      }

      this.emit(this.STATE_EVENTS.CHANGE_STATUS, this.STATE.OK)
      this.errorCount -= 1
    } catch (err) {
      this.log.debug(err)
      this.log.debug(err.stack)
      this.log.warning('follow error')
      this.dbUpdateStatus(username, `error: ${err}`)
      this.emit(this.STATE_EVENTS.CHANGE_STATUS, this.STATE.ERROR)
      await this.utils.screenshot(this.LOG_NAME, 'follow-after-click')
      this.errorCount += 1
      return false
    }
    // this.log.debug('===================================')
    // await this.defollowDebug('section main section div')
    // await this.defollowDebug('section main section div:nth-child(3)')
    // await this.defollowDebug('section main section div:nth-child(3) button')
    // await this.defollowDebug('section main section div:nth-child(3) button span')
    // this.log.debug('===================================')

    await this.utils.sleep(this.utils.random_interval(3, 6))

    // await this.utils.screenshot(this.LOG_NAME, 'last_follow_after')
  }

  async pageIsAvailable () {
    /* check if user exists
        > $('h2').innerText
        > "Sorry, this page isn't available."
    */

    const selector = 'h2'
    try {
      await this.bot.waitForSelector(selector, { timeout: 5000 + (Math.random() * 5000) })
    } catch (err) {
      this.log.error('Not even h2 available')
      return false
    }

    try {
      const selectorText = await this.bot.evaluate(el => el.innerText, await this.bot.$(selector))
      if (selectorText === 'Sorry, this page isn\'t available.') {
        return false
      }
      return true
    } catch (err) {
      this.log.error('pageIsAvailable(): Error when trying to evaluate h2')
      this.log.debug(err.stack)
    }

    return false
  }

  async userIsPrivate () {
    try {
      const isPrivateSelector = 'main article h2'
      await this.bot.waitForSelector(isPrivateSelector, { timeout: 5000 + (Math.random() * 5000) })
      const isPrivateText = await this.bot.evaluate(el => el.innerText, await this.bot.$(isPrivateSelector))
      this.log.debug(`isPrivateText: ${isPrivateText}`)
      this.errorCount -= 1
      if (isPrivateText.toLocaleLowerCase().indexOf('is private') !== -1) {
        // This profile is private
        return true
      }
    } catch (err) {
      if (!(err.name.startsWith('TimeoutError'))) {
        this.log.error(`openUsernamePage error when checking for is private: '${err.message}'`)
        this.log.debug(err.stack)
        this.errorCount += 1
        return true
      }
    }
    return false
  }

  /**
   * defollowRandomFollower
   * =====================
   * Click on follow and verify if instagram not (soft) ban you
   *
   */
  async defollowRandomFollower () {
    this.log.debug('try defollow a random follower')

    let username
    this.log.debug('Searching for follower to open...')
    while (username === undefined || !(await this.openUsernamePage(username))) {
      username = await this.dbGetFollowedFollower()

      if (this.cacheCompetitorFollowers.indexOf(username) !== -1) {
        this.cacheCompetitorFollowers.splice(this.cacheCompetitorFollowers.indexOf(username), 1)
      }

      this.utils.sleep(this.utils.random_interval(4, 7))
    }

    if (username === undefined) {
      return
    }
    this.log.debug(`Found user to try to defollow: '${username}.`)

    // Check if page is available
    if (!(await this.pageIsAvailable())) {
      return
    }

    let button
    let buttonBeforeClick
    try {
      const buttonDefollowSelector = '//*[@id="react-root"]/section/main/div/header/section/div[1]/div[2]/span/span[1]/button'
      await this.bot.waitForXPath(buttonDefollowSelector, { timeout: 5000 + (Math.random() * 5000) })
      button = await this.bot.$x(buttonDefollowSelector)
      buttonBeforeClick = await this.bot.evaluate(el => el.innerHTML, await this.bot.$x(buttonDefollowSelector))
      this.log.debug(`df button text before click: ${buttonBeforeClick}`)
      this.errorCount -= 1
    } catch (err) {
      // this.log.warning('Error when trying to find defollow-button')
      // this.log.error(`Error1: ${err.message}`)
      if (err.message.startsWith('waiting for XPath')) { // Ingen defollowknapp
        try {
          const buttonFollowSelector = 'main header span button'
          await this.bot.waitForSelector(buttonFollowSelector, { timeout: 5000 + (Math.random() * 5000) })
          // FOUND FOLLOW BUTTON, ALL IS WELL.
          this.log.info(`Not following '${username}', marking as defollowed.`)
          this.dbUpdateStatus(username, 'defollowed')
          this.emit(this.STATE_EVENTS.CHANGE_STATUS, this.STATE.OK)
          this.errorCount -= 1
          return true
        } catch (err2) { // Ingen followknapp
          this.log.error('No follow or defollow button.')
          this.log.debug(`Error2: ${err.message}`)
        }
      }
      this.log.warning('Error when trying to find defollow-button and follow button')
      this.log.error(`Error1: ${err.message}`)
      this.log.debug(err.stack)
      this.dbUpdateStatus(username, `error: ${err}`)
      await this.utils.screenshot(this.LOG_NAME, `defollow-find-defollow-button-${username}`)
      this.errorCount += 1
      return false
    }

    try {
      await button.click()
      this.errorCount -= 1
    } catch (err) {
      this.log.warning('Error when trying to click defollow')
      this.log.debug(err.stack)
      this.dbUpdateStatus(username, `error: ${err}`)
      await this.utils.screenshot(this.LOG_NAME, 'defollow-click-defollow-button')
      this.errorCount += 1
      return false
    }
    try {
      await this.bot.waitForSelector('div[role="dialog"] div > div:nth-child(3) button:nth-child(1)', { timeout: 3000 })
      const buttonConfirm = await this.bot.$('div[role="dialog"] div > div:nth-child(3) button:nth-child(1)')
      await buttonConfirm.click()
      await this.utils.sleep(this.utils.random_interval(1, 2))
      this.errorCount -= 1
    } catch (err) {
      this.log.warning('Error when trying to click confirm')
      this.log.debug(err.stack)
      this.dbUpdateStatus(username, `error: ${err}`)
      await this.utils.screenshot(this.LOG_NAME, 'defollow-click-confirm')
      this.errorCount += 1
      return false
    }

    try {
      const buttonAfterSelector = 'main header span button'
      await this.utils.sleep(this.utils.random_interval(2, 3))
      await this.bot.waitForSelector(buttonAfterSelector, { timeout: 5000 })
      this.log.debug(`button after $(): ${await this.bot.$(buttonAfterSelector)}`)
      const ele = await this.bot.evaluate(el => el, await this.bot.$(buttonAfterSelector))
      this.log.debug(`ele: ${ele}`)
      const attrs = await this.bot.evaluate(el => el.attributes, await this.bot.$(buttonAfterSelector))
      this.log.debug(`attrs: ${attrs}`)
      const buttonAfterClick = await this.bot.evaluate(el => el.attributes['aria-label'], await this.bot.$(buttonAfterSelector))

      this.log.debug(`button text after click: ${buttonAfterClick}`)

      if (buttonAfterClick !== buttonBeforeClick) {
        this.log.info(`Not following '${username}' anymore`)
        this.dbUpdateStatus(username, 'defollowed')
        this.currentCycleActionCount += 1
        this.errorCount -= 1
        this.cycleDefollows += 1
        this.totalDefollows += 1
      } else {
        this.log.warning('follow failed')
        this.errorCount += 1
      }
      this.emit(this.STATE_EVENTS.CHANGE_STATUS, this.STATE.OK)
    } catch (err) {
      this.log.debug(err)
      this.log.debug(err.stack)
      this.log.warning('follow error')
      this.dbUpdateStatus(username, `error: ${err}`)
      this.emit(this.STATE_EVENTS.CHANGE_STATUS, this.STATE.ERROR)
      await this.utils.screenshot(this.LOG_NAME, 'defollow-after-click-confirm')
      this.errorCount += 1
      return false
    }

    await this.utils.sleep(this.utils.random_interval(3, 6))

    // await this.utils.screenshot(this.LOG_NAME, 'last_defollow_after')
  }

  // async like_random_image () {
  //     this.log.info("like_click_heart2() try heart like random image from current url");

  //     try {
  //         const image_url = this.get_random_image_url_from_cache();
  //         if (image_url == "") {
  //             this.log.error(`like_random_image() didn't find any image_url`);
  //             return false;
  //         }
  //         this.log.debug(`goto: ${image_url}`);
  //         await this.bot.goto(image_url);
  //         await this.utils.sleep(this.utils.random_interval(3, 6));
  //     } catch (err) {
  //         this.log.error(`like_random_image() ${err}`);
  //         return false;
  //     }

  //     try {
  //         await this.bot.waitForSelector("article:nth-child(1) section:nth-child(1) button:nth-child(1)", {timeout: 3000});
  //         let button = await this.bot.$("article:nth-child(1) section:nth-child(1) button:nth-child(1)");
  //         let buttonBeforeClick = await this.bot.evaluate(el => el.innerHTML, await this.bot.$("article:nth-child(1) section:nth-child(1) button:nth-child(1)"));
  //         this.log.info(`button text before click: ${buttonBeforeClick}`);

  //         if (buttonBeforeClick.includes("filled") || buttonBeforeClick.includes("#ed4956")) {
  //             this.log.warning("</3 Skipped, liked previously");
  //         } else {
  //             if (!this.dryrun) {
  //                 await button.click();
  //             }
  //             await this.utils.sleep(this.utils.random_interval(2, 3));

  //             await this.bot.waitForSelector("article:nth-child(1) section:nth-child(1) button:nth-child(1)", {timeout: 5000});
  //             let buttonAfterClick = await this.bot.evaluate(el => el.innerHTML, await this.bot.$("article:nth-child(1) section:nth-child(1) button:nth-child(1)"));
  //             this.log.info(`button text after click: ${buttonAfterClick}`);

  //             if (buttonAfterClick.includes("filled") || buttonAfterClick.includes("#ed4956")) {
  //                 this.log.info("<3 Liked");
  //                 this.currentCycleActionCount += 1;
  //     /                this.totalLikecount += 1;
  //             } else {
  //                 this.log.warning("</3");
  //             }
  //         }
  //         this.emit(this.STATE_EVENTS.CHANGE_STATUS, this.STATE.OK);
  //     } catch (err) {
  //         if (this.utils.is_debug()) {
  //             this.log.debug(`like_click_heart2(): ${err}`);
  //         }

  //         this.log.warning("</3");
  //         this.emit(this.STATE_EVENTS.CHANGE_STATUS, this.STATE.ERROR);
  //     }

  //     await this.utils.sleep(this.utils.random_interval(3, 6));
  //     await this.utils.screenshot(this.LOG_NAME, "last_like_after");
  // }

  async refillCompetitorFollowers (force) {
    this.log.info('Refilling competitor followers.')
    // flush the cache by rereading it from the database
    this.cacheCompetitorFollowers = await this.dbGetFreshFolowers()
    if (!force && this.cacheCompetitorFollowers.length > 100) {
      return 0
    }
    const currentCompetitor = await this.openRandomCompetitorPage()
    if (currentCompetitor === undefined) {
      this.log.error('Couldn\'t load random competitor, quitting.')
      return
    }
    await this.utils.sleep(this.utils.random_interval(3, 6))
    return await this.getFollowersForUser(currentCompetitor)
  }

  getCycleActionCount () {
    const awakeMinutes = ((this.endDay - this.startDay) / 60)
    const meanCyclesPerDay = awakeMinutes / ((this.cycleDownTime[0] + this.cycleDownTime[1]) / 2)
    const target = Math.ceil((this.dailyFollows + (((this.dailyFollows * 0.1) - (this.dailyFollows * 0.05)) * Math.random())) / meanCyclesPerDay) * 2 // the last *2 is to count both follows and defollows
    return Math.max(1, target + ((Math.random() * target * 2) - target))
  }

  // +- 10%
  getRandomDailyFollowsTarget () {
    return (this.dailyFollows + (((this.dailyFollows * 0.1) - (this.dailyFollows * 0.05)) * Math.random()))
  }

  /*
    comp-follow: v:1 mv:1 weight:1 rand:-0.7934400673589157 desc:-1.7934400673589157
  */
  followOrDefollow () {
    const r = Math.random()
    if (r < 0.5) {
      return -1
    } else if (r > 0.5) {
      return 1
    } else {
      return 0
    }
    // FIXME: lägg in antal man följer och mål här istället
    //
    // const v = 1
    // const mv = 1
    // const weight = ((Math.max(9, (v - mv) / mv) + 1) / 5) - 1
    // const rand = (Math.random() * 2) - 1
    // const decision = rand - weight

    // this.log.debug(`v:${v} mv:${mv} weight:${weight} rand:${rand} desc:${decision}`)
    // if (decision < 0) {
    //   this.log.info('Defollow mode')
    //   return -1
    // } if (decision > 0) {
    //   this.log.info('Follow mode')
    //   return 1
    // }

    // this.log.info('NOP mode')
    // return 0
  }

  /**
     * Follow competitor followers Flow
     * =====================
     *
     */
  async start () {
    this.log.info('followmode_competitor_follower')

    this.initDB()
    let alive = true

    let cycleActionCount = this.getCycleActionCount()
    let dailyActionCount = 0
    let cycleCount = 0

    let followDefollowCycle = this.followOrDefollow()

    while (alive) {
      alive = await this.utils.keep_alive()
      this.errorCount = Math.max(0, this.errorCount) // Pin errorCount to >= 0

      const randDailyFollowTarget = this.getRandomDailyFollowsTarget()
      cycleCount += 1
      if (ssm() > this.startDay && ssm() < this.endDay && dailyActionCount < randDailyFollowTarget) {
        this.log.info(`Start ${(fdfCases[String(followDefollowCycle)])} cycle #${cycleCount} EC: ${this.errorCount} followers cache: ${this.cacheCompetitorFollowers.length}, cycle actions ${this.currentCycleActionCount} / ${randDailyFollowTarget}, daily actions: ${(dailyActionCount + this.currentCycleActionCount)} / ${this.dailyFollows}`)
        this.log.debug(` - cycle: f=${this.cycleFollows} df=${this.cycleDefollows} total: f=${this.totalFollows} df=${this.totalDefollows}`)
        // refill cache
        let refillLoopCount = 0
        let randomRefill = (Math.random() < 0.05)
        while ((randomRefill || this.cacheCompetitorFollowers.length < 20) && refillLoopCount < 3) {
          this.log.debug(`Starting refill loop, random: ${randomRefill} followers: ${this.cacheCompetitorFollowers.length} loop_count: ${refillLoopCount}`)
          const foundFollowersCount = await this.refillCompetitorFollowers(randomRefill)
          if (foundFollowersCount === undefined) {
            this.log.info('Found no followers trying again.')
          } else if (foundFollowersCount === 0) {
            this.log.info(`No followers needed, cache is at ${this.cacheCompetitorFollowers.length}.`)
          } else {
            this.log.info(`Found ${foundFollowersCount} new followers ${this.cacheCompetitorFollowers.length} total.`)
          }
          this.utils.sleep(this.utils.random_interval(3, 6))
          refillLoopCount += 1
          randomRefill = false
        }
        if (this.cacheCompetitorFollowers.length <= 0) {
          this.log.error(`ERROR failed to refil follower cache this.cacheCompetitorFollowers.length = ${this.cacheCompetitorFollowers.length}`)
          return // FIXME: set state error
        }

        if (followDefollowCycle === 1) {
          await this.followRandomFollower()
        } else if (followDefollowCycle === -1) {
          await this.defollowRandomFollower()
        }

        if (this.currentCycleActionCount > cycleActionCount || this.is_error() || this.errorCount > 3) {
          this.log.debug(`cacheCompetitorFollowers.length == ${this.cacheCompetitorFollowers.length}`)
          this.log.debug(`is_error() == ${this.is_error()}`)
          this.log.debug(`currentCycleActionCount: (${this.currentCycleActionCount}) > cycleActionCount (${cycleActionCount})`)

          const sleepTime = this.utils.random_interval(60 * this.cycleDownTime[0], 60 * this.cycleDownTime[1]) * (this.is_error() ? 2 : 1) // Sleep longer after error
          const awakeTimeStr = dateStr(new Date((new Date()).getTime() + sleepTime))
          this.log.info(`Sleeping to ${awakeTimeStr} (${Math.floor(sleepTime / 60000)} min).`)
          await this.utils.sleep(sleepTime)

          // reset
          dailyActionCount += this.currentCycleActionCount
          this.currentCycleActionCount = 0
          cycleActionCount = this.getCycleActionCount()
          this.errorCount = 0
          followDefollowCycle = this.followOrDefollow()
          this.emit(this.STATE_EVENTS.CHANGE_STATUS, this.STATE.OK)
        } else {
          await this.utils.sleep(this.utils.random_interval(9, 60))
        }
      } else {
        this.log.info(`Night: ${(ssm() < this.startDay || ssm() > this.endDay)}, follows: ${dailyActionCount} bot sleep`)
        this.log.debug(`ssm(): ${ssm()} startDay: ${this.startDay} endDay: ${this.endDay} dailyActionCount: ${dailyActionCount} randDailyFollowTarget: ${randDailyFollowTarget}`)
        await this.utils.sleep(this.utils.random_interval(60 * 4, 60 * 5))
        dailyActionCount = 0
        this.currentCycleActionCount = 0
      }
    }
  }
}

module.exports = (bot, config, utils) => {
  return new Followmode_competitor_followers(bot, config, utils)
}
