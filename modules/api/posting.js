/**
 * API: posting
 * =====================
 * Display posting
 *
 *
 * @license: This code and contributions have 'MIT License'
 *
 */

const Puppeteer = require("puppeteer");
const iPhone = Puppeteer.devices["iPhone X"];
const path = require("path");
const Log = require("./../logger/log");
const Translate = require("./../commons/translate");
const Utils = require("./../commons/utils");
const core = require("./../core/core");

class Posting {
	constructor(LOG_NAME = "api") {
		this.core = core;
		this.LOG_NAME = LOG_NAME;

		this.log = new Log(this.LOG_NAME);
		this.lang = new Translate();
		this.utils = new Utils();
	}
	
	/**
     * Post
     * =====================
     * Create an Instagram Post
     *
     * @param {string}  uri - Path to the image, relative to the assets directory
     *
     * @return {boolean} status         - true: successful / false: fail
     *         {string}  response.error - if status is false return error details
     *
     *
     */

	async post(uri = "example.jpeg", caption = "words") {
		let tag = "Posting::post()";
		this.log.info(tag, `${this.lang.translate("try_get_post")}`);
		let response = {"status": false};
		await this.core.bot.emulate(iPhone);
		await this.core.bot.goto("https://www.instagram.com");
		try {

			let selector = "nav div div:nth-child(2) div:nth-child(3) span";
			await this.core.bot.waitForSelector(selector, {timeout: 5000});
			let path_assets = `assets/${uri}`;
			let file_path = path.relative(process.cwd(), path_assets);
		    const [file_chooser] = await Promise.all([
				this.core.bot.waitForFileChooser(),
				this.core.bot.click(selector)
			]);
		    await file_chooser.accept([file_path]);
			await this.utils.sleep(this.utils.random_interval(3, 4));
			
			let selector_next = "header div:nth-child(3) button";
			
			await this.core.bot.waitForSelector(selector_next, {timeout: 5000});
		    let button_next = await this.core.bot.$(selector_next);
		    await button_next.click();
			await this.utils.sleep(this.utils.random_interval(3, 4));

			let selector_caption = "section section div textarea";
			await this.core.bot.waitForSelector(selector_caption, {timeout: 5000});
			await this.core.bot.type(selector_caption, caption, {delay: 300});

			await this.core.bot.waitForSelector(selector_next, {timeout: 5000});
		    let button_share = await this.core.bot.$(selector_next);
			await button_share.click();
			await this.utils.sleep(this.utils.random_interval(3, 4));

			let selector_done = "span[aria-label=\"Instagram\"]";
			await this.core.bot.waitForSelector(selector_done, {timeout: 30000});
			
			response.status = true;
		} catch (err) {
			response.status = false;
			response.error = err;
		}
		if (response.status) {
			this.log.info(tag, `${this.lang.translate("post_ok")}`);
			this.log.info(tag, `${this.lang.translate("done")}`);
		} else if (typeof response.error !== "undefined") {
			this.log.error(tag, `${this.lang.translate("post_ok")}`);
			this.log.error(tag, `${response.error}`);
			this.log.docs("api", tag);
			this.log.stackoverflow(tag, "puppeteer", response.error);
		}

		return response;
	}

	/**
     * Story
     * =====================
     * Create an Instagram Story
     *
     * @param {string}  uri - Path to the image, relative to the assets directory
     *
     * @return {boolean} status         - true: successful / false: fail
     *         {string}  response.error - if status is false return error details
     *
     *
     */

	async story(uri = "example.jpeg") {
		let tag = "Posting::story()";
		this.log.info(tag, `${this.lang.translate("try_get_story")}`);
		let response = {"status": false};
		await this.core.bot.emulate(iPhone);
		await this.core.bot.goto("https://www.instagram.com");
		try {

			let selector = "header div:nth-child(1) button";
			await this.core.bot.waitForSelector(selector, {timeout: 5000});
			let path_assets = `assets/${uri}`;
			let file_path = path.relative(process.cwd(), path_assets);
		    const [file_chooser] = await Promise.all([
				this.core.bot.waitForFileChooser(),
				this.core.bot.click(selector),
		    ]);
			await file_chooser.accept([file_path]);

			await this.utils.sleep(this.utils.random_interval(3, 4));
			let select = "footer div:nth-child(1) button";
			let button = await this.core.bot.$(select);
			await button.click();

			await this.utils.sleep(this.utils.random_interval(3, 4));
			response.status = true;
		} catch (err) {
			response.status = false;
			response.error = err;
		}
		if (response.status) {
			this.log.info(tag, `${this.lang.translate("story_ok")}`);
			this.log.info(tag, `${this.lang.translate("done")}`);
		} else if (typeof response.error !== "undefined") {
			this.log.error(tag, `${this.lang.translate("story_ok")}`);
			this.log.error(tag, `${response.error}`);
			this.log.docs("api", tag);
			this.log.stackoverflow(tag, "puppeteer", response.error);
		}

		return response;
	}
}

module.exports = Posting;
