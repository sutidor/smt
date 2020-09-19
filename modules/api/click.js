/**
 * API: Click
 * =====================
 * Bot click heart, submit form, click in buttons and inputs
 *
 * @contributors: Patryk Rzucidło [@ptkdev] <support@ptkdev.io> (https://ptk.dev)
 *
 * @license: This code and contributions have 'MIT License'
 *
 */
const Log = require("./../logger/log");
const Translate = require("./../commons/translate");
const Utils = require("./../commons/utils");
const core = require("./../core/core");

class Click {
	constructor(LOG_NAME = "api") {
		this.core = core;
		this.LOG_NAME = LOG_NAME;

		this.log = new Log(this.LOG_NAME);
		this.lang = new Translate();
		this.utils = new Utils();
	}

	/**
     * Love photo
     * =====================
     * Click on heart and verify if instagram not (soft) ban you
     *
     * @param {boolean} reload - refresh page after click, more accurate check (optional)
     *
     * @return {Object}  response        - {}
     *         {boolean} response.status - true: successful / false: fail
     *         {string}  response.error  - return error detail if status is false
     *
     * @since: v0.10
     *
     */
	async heart(reload = false) {
		let tag = "click::heart()";
		this.log.info(tag, `${this.lang.translate("try_click_heart")}`);

		let selector = "article:nth-child(1) section:nth-child(1) button:nth-child(1)";
		let response = {"status": false};

		if (typeof this.core.config.selectors[this.utils.clean_tag(tag)] !== "undefined") {
			selector = this.core.config.selectors[this.utils.clean_tag(tag)];
		}

		try {
			await this.core.bot.waitForSelector(selector, {timeout: 5000});
			let button = await this.core.bot.$(selector);
			let button_before_click = await this.core.bot.evaluate(el => el.innerHTML, await this.core.bot.$(selector));

			this.log.debug(tag, `${this.lang.translate("selector_before_click")} |> ${button_before_click}`);

			if (!button_before_click.includes("filled") && !button_before_click.includes("red")) {
				await button.click();

				await this.utils.sleep(this.utils.random_interval(2, 3));

				if (reload === true) {
					await this.core.bot.reload();
				}

				await this.core.bot.waitForSelector(selector, {timeout: 5000});
				let button_after_click = await this.core.bot.evaluate(el => el.innerHTML, await this.core.bot.$(selector));

				this.log.debug(tag, `${this.lang.translate("selector_after_click")} |> ${button_after_click}`);

				if (button_after_click.includes("filled") || button_after_click.includes("red")) {
					response.status = true;
				} else {
					response.status = false;
					response.warning = this.lang.translate("liked_previously");
				}
			} else {
				response.status = false;
				response.warning = this.lang.translate("liked_previously");
			}
		} catch (err) {
			response.status = false;
			response.error = err;
		}

		if (response.status) {
			this.log.info(tag, `${this.lang.translate("liked_ok")}`);
			this.log.info(tag, `${this.lang.translate("done")}`);
		} else if (typeof response.error !== "undefined") {
			this.log.error(tag, `${this.lang.translate("liked_ko")}`);
			this.log.error(tag, `${response.error}`);
			this.log.docs("api", tag);
			this.log.stackoverflow(tag, "puppeteer", response.error);
		} else if (typeof response.warning !== "undefined") {
			this.log.warning(tag, `${response.warning}`);
			this.log.docs("api", tag);
			this.log.stackoverflow(tag, "puppeteer", response.warning); 
		}

		return response;
	}

	/**
     * Follow
     * =====================
     * Click on follow button and verify if instagram not (soft) ban you
     *
     * @todo: add more where position or auto mode for <where> param: detect correct page automatically
     *
     * @param {string}  where -  - follow user from profile page, available values: profile (optional: default profile)
     * @param {boolean} reload - refresh page after click, more accurate check (optional)
     *
     * @return {Object}  response        - {}
     *         {boolean} response.status - true: successful / false: fail
     *         {string}  response.error  - return error detail if status is false
     *
     * @since: v0.10
     *
     */
	async follow(where = "profile", reload = false) {
		let tag = "click::follow()";
		this.log.info(tag, `${this.lang.translate("try_click_follow")}`);

		let dialog = null;
		let selector = "";
		let selector_profile = "main header section div:nth-child(1) span span button";
		let selector_dialog = "div[role='presentation'] div[role='dialog']";
		let response = {"status": false};

		switch (where) {
		  case "profile":
		    selector = selector_profile;
		    break;
		  default:
		    return response;
		}

		if (typeof this.core.config.selectors[this.utils.clean_tag(tag)] !== "undefined") {
			selector = this.core.config.selectors[this.utils.clean_tag(tag)];
		}

		try {
			await this.core.bot.waitForSelector(selector, {timeout: 5000});
			let button = await this.core.bot.$(selector);
			await button.click();

			await this.core.bot.waitForSelector(dialog, {timeout: 5000});

			dialog = await this.core.bot.evaluate(el => el.innerHTML, await this.core.bot.$(selector_dialog));

			if (reload === true) {
				await this.core.bot.reload();
			}
		} catch (err) {
			response.status = false;
			response.error = err;
		}

		if (typeof dialog === "undefined" || dialog === null || dialog === "") {
			response.status = true;
			delete response.error;
		} else {
			response.status = false;
		}

		if (response.status) {
			this.log.info(tag, `${this.lang.translate("follow_ok")}`);
			this.log.info(tag, `${this.lang.translate("done")}`);
		} else {
			this.log.error(tag, `${this.lang.translate("follow_ko")}`);
			this.log.error(tag, `${response.error}`);
			this.log.docs("api", tag);
			this.log.stackoverflow(tag, "puppeteer", response.error);
		}

		return response;
	}

	/**
     * DeFollow
     * =====================
     * Click on defollow button and confirm popup
     *
     * @todo: add more where position or auto mode for <where> param: detect correct page automatically
     *
     * @param {string}  where -  - follow user from profile page, available values: profile (optional: default profile)
     * @param {boolean} reload - refresh page after click, more accurate check (optional)
     *
     * @return {Object}  response        - {}
     *         {boolean} response.status - true: successful / false: fail
     *         {string}  response.error  - return error detail if status is false
     *
     * @since: v0.10
     *
     */
	async defollow(where = "profile", reload = false) {
		let tag = "click::defollow()";
		this.log.info(tag, `${this.lang.translate("try_click_defollow")}`);

		let dialog = null;
		let selector = "";
		let selector_profile = "main header section div:nth-child(1) span span button";
		let selector_dialog = "div[role='presentation'] div[role='dialog'] button:nth-child(1)";
		let response = {"status": false};

		switch (where) {
		  case "profile":
		    selector = selector_profile;
		    break;
		  default:
		    return response;
		}

		if (typeof this.core.config.selectors[this.utils.clean_tag(tag)] !== "undefined") {
			selector = this.core.config.selectors[this.utils.clean_tag(tag)];
		}

		try {
			await this.core.bot.waitForSelector(selector, {timeout: 5000});
			let button = await this.core.bot.$(selector);
			await button.click();

			await this.core.bot.waitForSelector(selector_dialog, {timeout: 5000});

			dialog = await this.core.bot.evaluate(el => el.innerHTML, await this.core.bot.$(selector_dialog));

			await this.core.bot.waitForSelector(selector_dialog, {timeout: 5000});
			let button_confirm = await this.core.bot.$(selector_dialog);
			await button_confirm.click();

			if (reload === true) {
				await this.core.bot.reload();
			}
		} catch (err) {
			response.status = false;
			response.error = err;
		}

		if (typeof dialog === "undefined" || dialog === null || dialog === "") {
			response.status = false;
		} else {
			response.status = true;
			delete response.error;
		}

		if (response.status) {
			this.log.info(tag, `${this.lang.translate("defollow_ok")}`);
			this.log.info(tag, `${this.lang.translate("done")}`);
		} else {
			this.log.error(tag, `${this.lang.translate("defollow_ko")}`);
			this.log.error(tag, `${response.error}`);
			this.log.docs("api", tag);
			this.log.stackoverflow(tag, "puppeteer", response.error);
		}

		return response;
	}

	/**
     * Submit form (login)
     * =====================
     * Click button for submit login form
     *
     * @return {Object}  response        - {}
     *         {boolean} response.status - true: successful / false: fail
     *         {string}  response.error  - return error detail if status is false
     *
     * @since: v0.10
     *
     */
	async login_form_submit() {
		let tag = "click::login_form_submit()";
		this.log.info(tag, `${this.lang.translate("try_click_submitlogin")}`);

		let response = {"status": false};
		let selector = null;

		if (typeof this.core.config.selectors[this.utils.clean_tag(tag)] !== "undefined") {
			selector = this.core.config.selectors[this.utils.clean_tag(tag)];
		}

		try {
			if (selector === null) {
				await this.core.bot.keyboard.press("Enter");
			} else {
				await this.core.bot.waitForSelector(selector, {timeout: 5000});
				let button = await this.core.bot.$(selector);
				await button.click();
			}

			response.status = true;
		} catch (err) {
			response.status = false;
			response.error = err;
		}

		if (response.status) {
			this.log.info(tag, `${this.lang.translate("done")}`);
		} else {
			this.log.error(tag, `${response.error}`);
			this.log.docs("api", tag);
			this.log.stackoverflow(tag, "puppeteer", response.error);
		}

		return response;
	}

	/**
     * Submit form (2fa)
     * =====================
     * Click button for submit 2fa form
     *
     * @return {Object}  response        - {}
     *         {boolean} response.status - true: successful / false: fail
     *         {string}  response.error  - return error detail if status is false
     *
     * @since: v0.10
     *
     */
	async twofa_form_submit() {
		let tag = "click::twofa_form_submit()";
		this.log.info(tag, `${this.lang.translate("try_click_submit2fa")}`);

		let response = {"status": false};
		let selector = null;

		if (typeof this.core.config.selectors[this.utils.clean_tag(tag)] !== "undefined") {
			selector = this.core.config.selectors[this.utils.clean_tag(tag)];
		}

		try {
			if (selector === null) {
				await this.core.bot.keyboard.press("Enter");
			} else {
				await this.core.bot.waitForSelector(selector, {timeout: 5000});
				let button = await this.core.bot.$(selector);
				await button.click();
			}

			response.status = true;
		} catch (err) {
			response.status = false;
			response.error = err;
		}

		if (response.status) {
			this.log.info(tag, `${this.lang.translate("done")}`);
		} else {
			this.log.error(tag, `${response.error}`);
			this.log.docs("api", tag);
			this.log.stackoverflow(tag, "puppeteer", response.error);
		}

		return response;
	}

	/**
     * Generic submit form
     * =====================
     * Click button for submit generic form
     *
     * @return {Object}  response        - {}
     *         {boolean} response.status - true: successful / false: fail
     *         {string}  response.error  - return error detail if status is false
     *
     * @since: v0.10
     *
     */
	async generic_submit_form() {
		let tag = "click::generic_submit_form()";
		this.log.info(tag, `${this.lang.translate("try_click_submitgeneric")}`);

		let response = {"status": false};
		let selector = "form button";

		if (typeof this.core.config.selectors[this.utils.clean_tag(tag)] !== "undefined") {
			selector = this.core.config.selectors[this.utils.clean_tag(tag)];
		}

		try {
			await this.core.bot.waitForSelector(selector, {timeout: 5000});
			await this.core.bot.$eval(selector, form => form.submit());

			response.status = true;
		} catch (err) {
			response.status = false;
			response.error = err;
		}

		if (response.status) {
			this.log.info(tag, `${this.lang.translate("done")}`);
		} else {
			this.log.error(tag, `${response.error}`);
			this.log.docs("api", tag);
			this.log.stackoverflow(tag, "puppeteer", response.error);
		}

		return response;
	}

	/**
   * Click send security code form (challenge required)
   * =====================
   * Click button for send security code form
	 * 
   * @return {Object}  response        - {}
   *         {boolean} response.status - true: successful / false: fail
   *         {string}  response.error  - return error detail if status is false
   *
   * @since: v0.10
   *
   */
	async challenge_send_code_form_submit() {
		let tag = "click::challenge_send_code_form_submit()";
		this.log.info(tag, `${this.lang.translate("try_click_send_security_code")}`);

		let response = {"status": false};
		let selector = "form button";

		if (typeof this.core.config.selectors[this.utils.clean_tag(tag)] !== "undefined") {
			selector = this.core.config.selectors[this.utils.clean_tag(tag)];
		}

		try {
			if (selector === null) {
				await this.core.bot.keyboard.press("Enter");
			} else {
				await this.core.bot.waitForSelector(selector, {timeout: 5000});
				let button = await this.core.bot.$(selector);
				await button.click();
			}

			response.status = true;
		} catch (err) {
			response.status = false;
			response.error = err;
		}

		if (response.status) {
			this.log.info(tag, `${this.lang.translate("done")}`);
		} else {
			this.log.error(tag, `${response.error}`);
			this.log.docs("api", tag);
			this.log.stackoverflow(tag, "puppeteer", response.error);
		}

		return response;
	}

	/**
   * Click choice method send security code form (challenge required)
   * =====================
   * Click option send security code for send security code form
	 * Depends on what you add those methods on your account
	 * 
	 * @param {string} choice - 0: SMS, 1: Email (optional: default 1: Email)
	 * 
   * @return {Object}  response        - {}
   *         {boolean} response.status - true: successful / false: fail
   *         {string}  response.error  - return error detail if status is false
   *
   * @since: v0.10
   *
   */
	async challenge_choice_method_send_code_form_submit(choice = 1) {
		let tag = "click::challenge_send_code_form_submit()";
		this.log.info(tag, `${this.lang.translate("try_click_send_security_code")}`);

		let response = {"status": false};
		let selector = `form label[for='choice_${choice}'] div`;

		if (typeof this.core.config.selectors[this.utils.clean_tag(tag)] !== "undefined") {
			selector = this.core.config.selectors[this.utils.clean_tag(tag)];
		}

		try {
			if (selector === null) {
				await this.core.bot.keyboard.press("Enter");
			} else {
				await this.core.bot.waitForSelector(selector, {timeout: 5000});
				let button = await this.core.bot.$(selector);
				await button.click();
			}

			response.status = true;
		} catch (err) {
			response.status = false;
			response.error = err;
		}

		if (response.status) {
			this.log.info(tag, `${this.lang.translate("done")}`);
		} else {
			this.log.error(tag, `${response.error}`);
			this.log.docs("api", tag);
			this.log.stackoverflow(tag, "puppeteer", response.error);
		}

		return response;
	}
}

module.exports = Click;