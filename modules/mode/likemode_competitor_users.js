/**
 * MODE: Likemode_competitor_users
 * =====================
 * Select account, get random followers, like random photos and sleep 15-20min.
 *
 * @author:     Ilya Chubarov [@agoalofalife] <agoalofalife@gmail.com>
 * @license:    This code and contributions have 'GNU General Public License v3'
 *
 */
const Manager_state = require("../common/state").Manager_state;
class Likemode_competitor_users extends Manager_state {
	constructor (bot, config, utils) {
		super();
		this.bot = bot;
		this.config = config;
		this.utils = utils;
		this.STATE = require("../common/state").STATE;
		this.STATE_EVENTS = require("../common/state").EVENTS;
		this.Log = require("../logger/log");
		this.LOG_NAME = "comp-like";
		/*
		this.account = this.config.likemode_competitor_users.account;
		this.account_url = `${this.url_instagram}${this.account}`;
		*/
		this.accounts = this.config.likemode_competitor_users
		this.cache_competitor_followers = [];
		this.cache_target_images = [];
		this.log = new this.Log(this.LOG_NAME, this.config);

		this.current_cycle_likecount = 0
		this.total_likecount = 0

		if (this.config.bot_sleep_night === false) {
			this.config.bot_start_sleep = "00:00";
		}
	}

	/**
     * Open random competitor account page
     * @return {Promise<void>}
     */
	async open_random_account_page () {
		const account = this.accounts[Math.floor(Math.random() * this.accounts.length)];
		const account_url = `https://www.instagram.com/${account}`
		this.log.info(`current account ${account}`);

		try {
			await this.bot.goto(account_url);
		} catch (err) {
			this.log.error(`goto ${err}`);
		}

		await this.utils.sleep(this.utils.random_interval(3, 6));
		await this.utils.screenshot(this.LOG_NAME, "account_page");
	}

	/**
     * Get follower url from cache
     * @return {string} url
     */
	get_random_follower_url_from_cache () {
		// FIXME: do not remove but tag with timestamp that we can clear after a sertan time
		let follower_url = "";
		do {
			follower_url = this.cache_competitor_followers.pop();
		} while ((typeof follower_url === "undefined" || follower_url.indexOf("www.instagram.com") === -1) && this.cache_competitor_followers.length > 0);
		return follower_url;
	}

	/**
     * Get image url from cache
     * @return {string} url
     */
	get_random_image_url_from_cache () {
		let image_url = "";
		do {
			image_url = this.cache_target_images.pop();
		} while ((typeof image_url === "undefined" || image_url.indexOf("www.instagram.com") === -1) && this.cache_target_images.length > 0);
		return image_url;
	}
	/**
     * Scroll followers
     * @return {Promise<Promise<*>|Promise<Object>|*|XPathResult>}
     */
	async scroll_followers () {
		this.log.info("scroll action");

		return this.bot.evaluate(() => {
			return new Promise((resolve) => {
				let counter = 5;
				let timer = setInterval(() => {
					document.querySelector("div[role=\"dialog\"] div:nth-child(2)").scrollBy(0, 5000);
					if (counter <= 0) {
						clearInterval(timer);
						resolve();
					} else {
						counter--;
					}
				}, 5000);
			});
		});
	}

	/**
     * Open page follower
     * @return {Promise<void>}
     */
	async open_random_follower_account () {
		const follower_url = this.cache_competitor_followers[Math.floor(Math.random() * this.cache_competitor_followers.length)];
		this.log.info(`open_random_follower_account(): current url from cache ${follower_url}`);
		await this.utils.sleep(this.utils.random_interval(3, 6));

		try {
			await this.bot.goto(follower_url);
		} catch (err) {
			this.log.error(`goto ${err}`);
			return false;
		}

		await this.utils.sleep(this.utils.random_interval(3, 6));
		return true;
	}

	/**
	 * Get random image from current user
	 * @return {Boolean}
	 */
	async get_random_user_images_url() {
		let image_url;
		while (this.cache_competitor_followers.length > 0) {
			await this.open_random_follower_account();
			await this.utils.sleep(this.utils.random_interval(3, 6))

			// get a random pic from user and goto that url
			try {
				let images_url = await this.bot.$$eval("article>div div div div a", hrefs => hrefs.map((a) => {
					return a.href;
				}));
				this.log.debug(`images_url-array: ${images_url.join(' ')}`)
				if (images_url.length === 0) {
					this.log.error(`No images_url found for current user`);
				} else {
					this.cache_target_images = this.cache_target_images
					return true
				}


			} catch (err) {
				if (this.utils.is_debug()) {
					this.log.debug(`get_random_user_images_url(): ${err}`);
				}
			}
		}

		if (image_url === undefined) {
			this.emit(this.STATE_EVENTS.CHANGE_STATUS, this.STATE.ERROR);
			return false;
		}
	}
	/**
     *
     * @return {Promise<void>}
     */
	async get_followers () {
		this.log.info("get_followers()");
		let selector_followers_count = "main header section ul li:nth-child(2) a";
		await this.bot.waitForSelector(selector_followers_count, {timeout: 5000});
		let area_count_followers = await this.bot.$(selector_followers_count);
		await area_count_followers.click();

		// scroll
		await this.scroll_followers(this.bot);

		try {
			const cache_competitor_followers = await this.bot.$$eval("div[role=\"dialog\"] ul li a", hrefs => hrefs.map((a) => {
				return a.href;
			}));

			this.cache_competitor_followers = this.cache_competitor_followers.concat(cache_competitor_followers)

			await this.utils.sleep(this.utils.random_interval(10, 15));

			if (this.utils.is_debug()) {
				this.log.debug(`array followers ${this.cache_competitor_followers.length}`);
			}

		} catch (err) {
			this.log.error(`get url followers error ${err}`);
			await this.utils.screenshot(this.LOG_NAME, "get_url_followers_error");
		}
	}

	async like_random_image () {
		this.log.info("like_click_heart2() try heart like random image from current url");

		try {
			const image_url = this.get_random_image_url_from_cache()
			if (image_url == "") {
				this.log.error(`like_random_image() didn't find any image_url`)
				return false
			}
			this.log.debug(`goto: ${image_url}`)
			await this.bot.goto(image_url);
			await this.utils.sleep(this.utils.random_interval(3, 6))
		} catch (err) {
			this.log.error(`like_random_image() ${err}`)
			return false
		}

		try {
			await this.bot.waitForSelector("article:nth-child(1) section:nth-child(1) button:nth-child(1)", {timeout: 3000});
			let button = await this.bot.$("article:nth-child(1) section:nth-child(1) button:nth-child(1)");
			let button_before_click = await this.bot.evaluate(el => el.innerHTML, await this.bot.$("article:nth-child(1) section:nth-child(1) button:nth-child(1)"));
			this.log.info(`button text before click: ${button_before_click}`);

			if (button_before_click.includes("filled") || button_before_click.includes("#ed4956")) {
				this.log.warning("</3 Skipped, liked previously");
			} else {
				await button.click();
				await this.utils.sleep(this.utils.random_interval(2, 3));

				await this.bot.waitForSelector("article:nth-child(1) section:nth-child(1) button:nth-child(1)", {timeout: 5000});
				let button_after_click = await this.bot.evaluate(el => el.innerHTML, await this.bot.$("article:nth-child(1) section:nth-child(1) button:nth-child(1)"));
				this.log.info(`button text after click: ${button_after_click}`);

				if (button_after_click.includes("filled") || button_after_click.includes("#ed4956")) {
					this.log.info("<3 Liked");
					this.current_cycle_likecount += 1
					this.total_likecount += 1
				} else {
					this.log.warning("</3");
				}
			}
			this.emit(this.STATE_EVENTS.CHANGE_STATUS, this.STATE.OK);
		} catch (err) {
			if (this.utils.is_debug()) {
				this.log.debug(`like_click_heart2(): ${err}`);
			}

			this.log.warning("</3");
			this.emit(this.STATE_EVENTS.CHANGE_STATUS, this.STATE.ERROR);
		}

		await this.utils.sleep(this.utils.random_interval(3, 6));
		await this.utils.screenshot(this.LOG_NAME, "last_like_after");
	}


	/**
     * LikemodeClassic Flow
     * =====================
     *
     */
	async start () {
		this.log.info("competitor_users");

		let today = "";
		let alive = true;

		// Seed cache
		await this.open_random_account_page();
		await this.utils.sleep(this.utils.random_interval(3, 6));
		await this.get_followers();

		do {
			alive = await this.utils.keep_alive();
			if (alive == false) {
				break;
			}

			// FIXME: Proper compare of time
			today = new Date();
			this.log.info(`time night: ${parseInt(`${today.getHours()}${today.getMinutes() < 10 ? "0" : ""}${today.getMinutes()}`)}`);
			if ((parseInt(`${today.getHours()}${today.getMinutes() < 10 ? "0" : ""}${today.getMinutes()}`) >= (this.config.bot_start_sleep).replace(":", ""))) {

				this.log.info(`loading... ${new Date(today.getFullYear(), today.getMonth(), today.getDate(), today.getHours(), today.getMinutes(), today.getSeconds())}`);
				this.log.info(`cache array size ${this.cache_competitor_followers.length}`);

				await this.get_random_user_images_url();
				await this.like_random_image();

				alive = await this.utils.keep_alive();
				if (alive == false) {
					this.log.error(`this.utils.keep_alive() returned false`)
					break;
				}

				// FIXME: current_cycle_likecount should be configurable
				const likecount_max = Math.floor(Math.random()*50) + 5
				if (this.cache_target_images.length <= 0 || this.current_cycle_likecount > likecount_max || this.is_error()) {
					this.log.info(`finish fast like, bot sleep ${this.config.bot_fastlike_min}-${this.config.bot_fastlike_max} minutes`);
					this.log.info(`total_likecount = ${this.total_likecount}`)
					this.log.debug(`cache_competitor_followers.length == ${this.cache_competitor_followers.length}`)
					this.log.debug(`cache_target_images.length == ${this.cache_target_images.length}`)
					this.log.debug(`get_status() == ${this.get_status()}`)
					this.log.debug(`current_cycle_likecount (${this.current_cycle_likecount}) > ${likecount_max}`)
					await this.utils.sleep(this.utils.random_interval(60 * this.config.bot_fastlike_min, 60 * this.config.bot_fastlike_max));

					this.current_cycle_likecount = 0;

					if (this.cache_target_images < 20) {
						// refill cache
						this.log.info(`Refilling competitor followers.`)
						await this.open_random_account_page();
						await this.utils.sleep(this.utils.random_interval(3, 6));
						await this.get_followers();
					}

				} else {
					await this.utils.sleep(this.utils.random_interval(3, 6));
				}



			} else {
				this.log.info("is night, bot sleep");
				await this.utils.sleep(this.utils.random_interval(60 * 4, 60 * 5));
			}

		} while (true);
	}

}

module.exports = (bot, config, utils) => {
	return new Likemode_competitor_users(bot, config, utils);
};