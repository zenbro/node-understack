# understack

Translate stacktraces from minified JS to readable format.  
This lib relies on [source-map](https://github.com/mozilla/source-map/) (by Mozilla) to find position of given line and column.

## Install

``` bash
npm install understack
```

## Usage

### Example 1: one source-map and same path for original js files

Suppose your project structure looks like this:

* `project/src/foo.js`
* `project/src/bar.js`
* `project/build/minified/min.js` - result of compiling `foo.js` and `bar.js`
* `project/build/minified/source_map` - source-map for `min.js`
* `project/script.js` - here you require understack.js

``` javascript
var understack = require('understack');
understack.addSourceMap(__dirname + 'build/minified/source_map', function(err) {
  if (err) console.log(err);
});
// . . .
// get error with stacktrace from minified code
var stack = err.stack;
understack.read(stack, function(originStack) {
  // do something with original stacktrace
});
```

## TODO

* write more examples
* improve error handling
* write some tests
