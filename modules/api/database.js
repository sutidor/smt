/**
 * API: database
 * =====================
 * Database manager of logs (sqlite3)
 *
 * @contributors: Patryk Rzucidło [@ptkdev] <support@ptkdev.io> (https://ptk.dev)
 *
 * @license: This code and contributions have 'MIT License'
 *
 */
const Low = require("lowdb");
const Low_sync = require("lowdb/adapters/FileSync");
const uuid = require('uuid').v4;
const Log = require("./../logger/log");
const Translate = require("./../commons/translate");
const Utils = require("./../commons/utils");
const core = require("./../core/core");

class Database {
	constructor(LOG_NAME = "api") {
		this.core = core;
		this.LOG_NAME = LOG_NAME;

		this.local = {};
		this.local.db = null;
		this.local.db_name = null;

		this.log = new Log(this.LOG_NAME);
		this.lang = new Translate();
		this.utils = new Utils();
	}

	/**
     * Init
     * =====================
     * Create database schema if not exist and return adapter
     *
     * @param {Object} db_name -  - string of database name, if use api mode::flow() set mode name (mandatory)
     * @param {Object} database - path of database (optional, default from config of current mode)
     *
     * @return {Object}  response        - {}
     *         {boolean} response.status - true: successful / false: fail
     *         {string}  response.error  - return error detail if status is false
     *
     * @since: v0.10
     *
     */
	async init(db_name, database = null) {
		this.local.db_name = db_name;
		if (database === null) {
			database = this.core.config.bot_mode_options[this.local.db_name].database.default;
		}
		let tag = "database::init()";
		this.log.info(tag, `${this.lang.translate("try_database_init")}`);

		let response = {"status": false};
		const adapter = new Low_sync(database);
		this.local.db = Low(adapter);
		let elements = {};
		elements[this.local.db_name] = [];

		try {
			if (!this.local.db.has(this.local.db_name).value()) {
				await this.local.db.defaults(elements).write();
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
			this.log.stackoverflow(tag, "lowdb", response.error);
		}

		return response;
	}

	/**
     * Insert
     * =====================
     * Insert json to database
     *
     * @param {Object} json -    - insert json object into json database (mandatory)
     *
     * @return {Object}  response        - {}
     *         {boolean} response.status - true: successful / false: fail
     *         {string}  response.error  - return error detail if status is false
     *
     * @since: v0.10
     *
     */
	async insert(json) {
		let tag = "database::insert()";
		this.log.info(tag, `${this.lang.translate("try_database_insert")}`);

		let response = {"status": false};

		try {
			json.id = uuid();
			json.timestamp = Date.now();
			await this.local.db.get(this.local.db_name).push(json).write();
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
			this.log.stackoverflow(tag, "lowdb", response.error);
		}

		return response;
	}

	/**
     * Update
     * =====================
     * Update values from json database
     *
     * @param {Object} search - json object with keys to find (mandatory)
     * @param {Object} json -   - json with values for replace (mandatory)
     *
     * @return {Object}  response        - {}
     *         {boolean} response.status - true: successful / false: fail
     *         {string}  response.error  - return error detail if status is false
     *
     * @since: v0.10
     *
     */
	async update(search, json) {
		let tag = "database::insert()";
		this.log.info(tag, `${this.lang.translate("try_database_insert")}`);

		let response = {"status": false};

		try {
			json.timestamp_update = Date.now();
			await this.local.db.get(this.local.db_name).find(search).assign(json).write();
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
			this.log.stackoverflow(tag, "lowdb", response.error);
		}

		return response;
	}

	/**
     * Exist
     * =====================
     * Exist values from json database
     *
     * @param {Object} search - json object with keys to find (mandatory)
     *
     * @return {Object}  response        - {}
     *         {boolean} response.status - true: successful / false: fail
     *         {string}  response.error  - return error detail if status is false
     *
     * @since: v0.10
     *
     */
	async exist(search) {
		let tag = "database::exist()";
		this.log.info(tag, `${this.lang.translate("try_database_check_exist")}`);

		let response = {"status": false};

		try {
			response.value = await this.local.db.get(this.local.db_name).find(search).value();
			if (typeof response.value !== "undefined") {
				response.exist = true;
			} else {
				response.exist = false;
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
			this.log.stackoverflow(tag, "lowdb", response.error);
		}

		return response;
	}

}

module.exports = Database;