/**
 * Routes
 * =====================
 * Possible strategy
 *
 * @author:     Ilya Chubarov [@agoalofalife] <agoalofalife@gmail.com>
 * @license:    This code and contributions have 'GNU General Public License v3'
 *
 */
module.exports = {
	"direct_new_followers": require("../modules/mode/direct_new_followers"),
	"likemode_classic": require("../modules/mode/likemode_classic"),
	"likemode_realistic": require("../modules/mode/likemode_realistic"),
	"likemode_superlike": require("../modules/mode/likemode_superlike"),
	"fdfmode_classic": require("../modules/mode/fdfmode_classic"),
	"comment_mode": require("../modules/mode/commentmode_classic"),
	"likemode_competitor_users": require("../modules/mode/likemode_competitor_users"),
	"followmode_competitor_followers": require("../modules/mode/followmode_competitor_followers")
};