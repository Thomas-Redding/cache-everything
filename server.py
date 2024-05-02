from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import sqlite3
import sys
import time
import urllib.parse

class Database:
  def __init__(self, dbpath):
    self._connection = sqlite3.connect(dbpath)
    self._cursor = self._connection.cursor()
    self._cursor.execute("""
      CREATE TABLE IF NOT EXISTS items(
        url TEXT,
        request_headers TEXT,
        status_code INTEGER,
        response_headers TEXT,
        body BLOB,
        epochtime REAL
      );
    """)
    self._cursor.execute("""
      CREATE INDEX IF NOT EXISTS url_index ON items(url, epochtime);
    """)

  def add(self, url, request_headers, status_code, response_headers, body):
    assert type(url) == str
    for header in request_headers:
      assert type(header['name']) == str
      assert type(header['value']) == str
    assert type(status_code) == int
    assert type(response_headers) == list
    for header in response_headers:
      assert type(header['name']) == str
      assert type(header['value']) == str
    assert type(body) == bytes
    self._cursor.execute("""
      INSERT INTO items(url, request_headers, status_code, response_headers, body, epochtime)
      VALUES (?, ?, ?, ?, ?, ?);
    """, (url, json.dumps(request_headers), status_code, json.dumps(response_headers), body, time.time()))


  def head(self, url):
    assert type(url) == str
    self._cursor.execute("""
      SELECT status_code, response_headers
      FROM items
      WHERE url = ?
      ORDER BY epochtime DESC
      LIMIT 1;
    """, (url,))
    rows = self._cursor.fetchall()
    assert len(rows) <= 1
    return None if len(rows) == 0 else {
      'status_code': rows[0][0],
      'headers': json.loads(rows[0][1]),
    }

  def get(self, url):
    assert type(url) == str
    self._cursor.execute("""
      SELECT status_code, response_headers, body
      FROM items
      WHERE url = ?
      ORDER BY epochtime DESC
      LIMIT 1;
    """, (url,))
    rows = self._cursor.fetchall()
    assert len(rows) <= 1
    return None if len(rows) == 0 else {
      'status_code': rows[0][0],
      'headers': json.loads(rows[0][1]),
      'body': rows[0][2],
    }

  def commit(self):
    self._connection.commit()

  def close(self):
    self._connection.close()

gDatabase = Database(sys.argv[1])

class MyServer(BaseHTTPRequestHandler):
  def _set_headers(self):
    self.send_response(200)
    self.send_header("Content-type", "text/html")
    self.end_headers()

  def do_HEAD(self):
    url = urllib.parse.unquote(self.path[1:])
    response = gDatabase.head(url)
    if not response:
      self._send(404, 'Not Found')
      return
    self._send(response['status_code'], None, response['headers'])

  def do_GET(self):
    url = urllib.parse.unquote(self.path[1:])
    response = gDatabase.get(url)
    if not response:
      self._send(404, 'Not Found')
      return
    self._send(response['status_code'], response['body'], response['headers'])

  def do_PUT(self):
    url = urllib.parse.unquote(self.path[1:])
    status_code = self.headers.get('local-cache-status-code')
    request_headers = self.headers.get('local-cache-request-headers')
    response_headers = self.headers.get('local-cache-response-headers')
    try:
      status_code = int(status_code)
    except:
      self._send(400, 'Bad Request: local-cache-status-code was not an integer.')
      return
    try:
      request_headers = json.loads(request_headers)
    except:
      self._send(400, 'Bad Request: local-cache-request-headers was not a valid JSON.')
      return
    try:
      response_headers = json.loads(response_headers)
    except:
      self._send(400, 'Bad Request: local-cache-response-headers was not a valid JSON.')
      return
    body_bytes = self.rfile.read(int(self.headers['Content-Length']))
    gDatabase.add(url, request_headers, status_code, response_headers, body_bytes)
    self._send(200, 'Ok')
    return

  def do_POST(self):
    gDatabase.commit()
    self._send(200, 'Ok')
    return

  def _send(self, status_code, message, headers=[{'name': 'Content-type', 'value': 'text/plain'}]):
    assert type(status_code) == int
    assert 100 <= status_code <= 599
    assert type(message) in (str, bytes, None)
    assert type(headers) in (tuple, list)
    for header in headers:
      assert type(header) == dict
      assert type(header['name']) == str
      assert type(header['value']) == str
    self.send_response(status_code)
    for header in headers:
      self.send_header(header['name'], header['value'])
    self.end_headers()
    if type(message) == str:
      self.wfile.write(message.encode('utf-8'))
    elif type(message) == bytes:
      self.wfile.write(message)


def run(server_class=HTTPServer, handler_class=MyServer, addr="localhost", port=8000):
  server_address = (addr, port)
  httpd = server_class(server_address, handler_class)
  print(f"Starting httpd server on {addr}:{port}")
  httpd.serve_forever()
  print('foo')
  print('bar')

if __name__ == "__main__":
  run(addr='localhost', port=8080)
