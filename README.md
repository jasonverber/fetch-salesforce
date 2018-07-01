# fetch-salesforce
A lightweight (no dependencies) javascript object for accessing the Salesforce REST API via OAuth. Uses `fetch()` to return Promises for arrays of results.

To use, simply include on the landing page after Salesforce's OAuth redirect and create a new session:
```javascript
var sf = salesforceSession(); //Automatically passes the current location in order to processes the access token, instance URL, etc.
sf.query("SELECT Id, Name FROM Contact")
  .then(records=>{
    //Do something with the records.
    });
    
var results = await sf.search("FIND {Arthur Dent}");
```
*Note, you will need to include your domain on the Salesforce CORS whitelist!*

## Supported methods include:

`sf.query(string)`: Runs the provided soql query. If none is provided, it checks `sf.soql` for a query to run. Saves the query to `sf.soql` and returns a Promise resolving into an array of records. Records are also stored at `sf.records`.

`sf.search(string)`: Runs the provided sosl search. If none is provided, it checks `sf.sosl` for a search to run. Saves the search to `sf.sosl` and returns a Promise resolving into an array of search records. Search records are also stored at `sf.searchRecords`.

`sf.insert(object)`: Inserts the provided object or array of objects.

`sf.update(object)`: Updates the provided object or array of objects.

## To do:
- Add support for `sf.delete()`
- Improve documentation.
