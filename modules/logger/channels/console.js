/**
 * Console
 * =====================
 * Log in channel is console
 *
 * @author:     Ilya Chubarov [@agoalofalife] <agoalofalife@gmail.com>
 * @license:    This code and contributions have 'GNU General Public License v3'
 *
 */
function dateStr (dateObj) {
  if (dateObj === undefined) {
    dateObj = new Date()
  }
  return new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().replace(/\.[0-9]{3}Z$/, '').replace('T', ' ')
}

class Console {
  constructor () {
    this.MAP_COLORS = require('./../types').MAP_COLORS
  }

  /**
     * Run is log in output console
     * @param type
     * @param func
     * @param message
     */
  log (type, func, message) {
    const color = this.MAP_COLORS[type]
    console.log(`${dateStr()} ${type} ${func}: ${message}`[color])
  }
}

module.exports = () => {
  return new Console()
}
