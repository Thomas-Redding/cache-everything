# README

The `server.py` file is a Python server that accepts four request types
* `PUT` - used to save a request-response pair to the sqlite database provided as an argument
* `POST` - used to commit to the database
* `GET` - used to fetch the most recent response at the given URL
* `HEAD` - same as `GET` but only fetches the response headers

The CLI is very simple:

```bash
> python3 server.py path/to/cache.db
```


The `firefox-extension` directory contains a Firefox extension that intercepts every request and response and sends the associated data to the server.

Important Notes:
* For anything more complicated (e.g. depending on request headers or timing), it is recommended that you read from the resulting sql table directly. The `server.py` function is only to support the extension and basic functionality.
* There is *no* deduping logic, so `cache.db` might grow quickly.
* Because `filterResponseData` is supported on Firefox (but not Chrome), the Chrome extension is unfortunately needs to duplicate every request sent.
