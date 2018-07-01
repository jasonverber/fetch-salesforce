/**
 * @file Lightweight access to Salesforce REST API.
 * @author Jason Verber <jason.verber@gmail.com>
 */

'use strict';

const salesforceSession = (_OAuthUrl = document.location.toString(), { 
	_instanceUrl = 'https://test.salesforce.com',
	_servicesPath = '/services/data/',
	version = '43.0'
} = {}) => {
	var _authenticated = false,
		_expired = false,
		_OAuthVars = {},
		_requests = 0,
		_requestErrors = 0,
		_servicesPath = '/services/data/',
		records,
		searchRecords,
		insertResults,
		updateResults,
		soql,
		sosl,
		version;

	const _url = (path='') => _OAuthVars.instance_url + _servicesPath + 'v' + version + '/' + path;

	_OAuthVarPairs = _OAuthUrl.split('#')[1].split('&');
	for (let i = 0; i < _OAuthVarPairs.length; i++) {
		let pair = _OAuthVarPairs[i].split('=');
		_OAuthVars[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
	}

	if (_instanceUrl) _OAuthVars.instance_url = _instanceUrl;

	/**
	* Makes a Salesforce request.
	* @private
	* @param {string} method The HTTP method to use.
	* @param {string} action The action represented by a query string to be appended to the Salesforce URL.
	* @param {object} payload Optional payload for inclusion in this request.
	* @param {object} optionalParameters Parameters for the fetch request.
	* @returns {string} Response from fetch request.
	*/
	const _request = async (method, action, payload, optionalParameters, retry) => {
		var cacheString = method+"-"+action;
		var url = _url(action);

		optionalParameters = _parameters(optionalParameters);
		optionalParameters.method = method;
		if (payload) {
			var jPayload = JSON.stringify(payload);
			optionalParameters.headers['Content-Type'] = "application/json";
			optionalParameters.body = jPayload;
		}
		try {
			_requests++;
			var request = await fetch(url, optionalParameters);
			var response = (method.toLowerCase() == "patch") ? request.getResponseCode() : await request.json();
			return response;
		} catch(e){
			_requestErrors++;
			if (!retry) retry = 0;
			if (retry < 3) {
				return _request(method, action, payload, optionalParameters, retry+1);
			}
			console.log("EXCEPTION!!!");
			throw "Salesforce " + method.toUpperCase() + " request failed!";
			return false;
		}
	};

	/**
	* Makes a Salesforce GET request.
	* @private
	* @param {string} action The action represented by a query string to be appended to the Salesforce URL.
	* @param {object} optionalParameters Parameters for the fetch request.
	* @returns {string} Response from fetch request.
	*/
	const _get = async (action, optionalParameters) => {
		if (Array.isArray(action)) {
			return this.batch(action, optionalParameters);
		}
		if (_url(action).length > 2048) { //A long query is going to fail because of Google Script limitations to URL length. Workaround by POST via batch.
			var aBatch = [{method:"GET",url:'v' + version + '/' + action}];
			return this.batch(aBatch, optionalParameters).results[0].result; //It's a batch of just one item, so we just need that first (and only) result.
		}
		return await _request("get", action, null, optionalParameters);
	};

	/**
	* Makes a Salesforce POST request.
	* @private
	* @param {string} action The action represented by a query string to be appended to the Salesforce URL.
	* @param {object} payload Optional payload for inclusion in this request.
	* @param {object} optionalParameters Parameters for the fetch request.
	* @returns {string} Response from fetch request.
	*/
	const _post = async (action, payload, optionalParameters) => {
		return await _request("post", action, payload, optionalParameters);
	};

	/**
	* Makes a Salesforce PATCH request.
	* @private
	* @param {string} action The action represented by a query string to be appended to the Salesforce URL.
	* @param {object} payload Payload for inclusion in this request.
	* @param {object} optionalParameters Parameters for the fetch request.
	* @returns {string} Response from fetch request.
	*/
	const _patch = async (action, payload, optionalParameters) => {
		return await _request("patch", action, payload, optionalParameters);
	};

	/**
	* Gets HTTP headers and applies them to any other optional parameters.
	* @private
	* @param {object} optionalParameters Optional parameters for fetch requests.
	* @returns {object} Parameters object for fetch requests.
	*/
	const _parameters = (optionalParameters) => {
		var httpheaders = {Authorization: _OAuthVars.token_type + ' ' + _OAuthVars.access_token};
		if (optionalParameters) {
			optionalParameters.headers = httpheaders;
		} else {
			optionalParameters = {headers: httpheaders};
		}
		return optionalParameters;
	};

	return {
		records,
		searchRecords,
		insertResults,
		updateResults,
		soql,
		sosl,
		version,
		/**
		* Perform a Salesforce query.
		* @param {string} mySoql The query to execute. If none provided, uses this.soql.
		* @param {object} optionalParameters Parameters for the fetch request.
		* @returns {promise} Promise resolving to array of records returned by query.
		*/
		async query (mySoql=this.soql, parameters){
			this.soql = mySoql;

			let query = "query?q="+encodeURIComponent(this.soql);
			
			try{
				parameters = _parameters(parameters); 
				let results = await _get(query, parameters);
				this.records = results.records;
				while (results.nextRecordsUrl != undefined) {
					let results = await _get(results.nextRecordsUrl, _parameters());
					this.records = this.records.concat(results.records);
				}
				return this.records;
			} catch(e){
				console.log("EXCEPTION!!!");
				console.log(e);
				this.records = false;
				throw "Query failed!";
				return false;
			}	
		},
		/**
		* Perform a Salesforce search.
		* @param {string} mySosl The search to execute. If none provided, uses this.sosl.
		* @param {object} optionalParameters Parameters for the fetch request.
		* @returns {promise} Promise resolving to array of records returned by search.
		*/
		async search (mySosl=this.sosl, parameters){
			this.sosl = mySosl;

			let search = "search?q="+encodeURIComponent(this.sosl);

			try{
				parameters = _parameters(parameters);
				let results = await _get(search, parameters);
				this.searchRecords = results.searchRecords;
				while (results.nextRecordsUrl != undefined) {
					let results = await _get(results.nextRecordsUrl, _parameters());
					this.searchRecords = this.searchRecords.concat(results.searchRecords);
				}
				return this.searchResults;
			} catch(e){				
				console.log("EXCEPTION!!!");
				console.log(e);
				this.searchRecords = false;
				throw "Search failed!";
				return false;
			} 
		},

		/**
		* Makes a Salesforce BATCH request.
		* @param {array} requests An array of the requests to be made.
		* @param {object} optionalParameters Parameters for the fetch request.
		* @returns {string} Response from fetch requests.
		*/
		async batch (requests, optionalParameters) {
			var action = "composite/batch/";
			if (!requests[0].method){
				for (var i = 0; i < requests.length; i++){
					requests[i] = {method:"GET",url:'v' + version + '/' + requests[i]};
				}
			}
			
			var batchResponses = false;
			while (requests.length > 0) {
				var batchRequests = requests.splice(0,25);
				var payload =	{"batchRequests" : batchRequests};
				try {
					var thisResponse = await _post(action, payload, optionalParameters);
					if (!batchResponses) batchResponses = thisResponse; else batchResponses.results.concat(thisResponse.results);
					_requests--; //Don't count this request, it's part of a batch request that we've broken up for length reasons.
				} catch(e){
					console.log("EXCEPTION!!!");
					console.log(e);
					throw "Salesforce batch request failed!";
					return false;
				}
			}
			_requests++
			return batchResponses;
		},

		/**
		* Insert Salesforce records.
		* @param {array} oRecords An array of the records to be inserted.
		* @returns {array} An array of Salesforce records with Ids.
		*/
		async insert (oRecords){
			//If we have only one record and it has attributes and a type then use it.
			if (oRecords && oRecords.attributes && oRecords.attributes.type) oRecords = [oRecords];
			//Any records to be submitted need to be in an array, and each object in the array needs .attributes and .type
			if (!oRecords || !Array.isArray(oRecords) || !oRecords[0].attributes || !oRecords[0].attributes.type) throw new Error("No valid records to insert!");
			var type = oRecords[0].attributes.type;

			//Special URL for multiple oRecords.
			var url = "composite/tree/"+type+"/";
		 
			//Initialize the array for our results.
			this.insertReults = [];
			try {
			//Batches of 200 (maximum allowed by Salesforce)
				while (oRecords.length > 0) {
					var oRecordsBatch = oRecords.splice(0,200);
					var payload =	{"records" : oRecordsBatch};
					this.insertReults = this.insertReults.concat(await _post(url, payload).results);
				}
				return this.insertReults;
			} catch(e){
				console.log("EXCEPTION!!!");
				console.log(e);
				this.insertResults = false;
				throw "Salesforce "+type+" insertion failed!";
				return false;
			}
		},

		/**
		* Update Salesforce records.
		* @param {array} oRecords An array of the records to be updated.
		* @returns {array} An array of Salesforce records with Ids.
		*/
		async update (oRecords){
			//If we have only one record and it has attributes and a type then use it.
			if (oRecords && oRecords.attributes && oRecords.attributes.type) oRecords = [oRecords];
			//Any records to be submitted need to be in an array, and each object in the array needs .attributes and .type
			if (!oRecords || !Array.isArray(oRecords) || !oRecords[0].attributes || !oRecords[0].attributes.type) throw new Error("No valid records to update!");
			var type = oRecords[0].attributes.type;

			//Special URL for multiple oRecords.
			var url = "composite/sobjects?_HttpMethod=PATCH";
		 
			//Initialize the array for our results.
			this.updateResults = [];
			try {
			//Batches of 200 (maximum allowed by Salesforce)
				while (oRecords.length > 0) {
					var oRecordsBatch = oRecords.splice(0,200);
					var payload =	{"records" : oRecordsBatch};
					this.updateResults = this.updateResults.concat(await _post(url, payload));
				}
				return this.updateResults;
			} catch(e){
				console.log("EXCEPTION!!!");
				console.log(e);
				this.updateResults = false;
				throw "Salesforce "+type+" update failed!";
				return false;
			}
		}
	}
};