var sourceMapConsumer = require('source-map').SourceMapConsumer,
    fs = require('fs'),
    path = require('path'),
    maps = {};

module.exports.addSourceMap = function(options, callback) {
  var sourceMapPath;
  if (! options) {
    var err = new Error('UnderStack Error - invalid options');
    callback(err);
    return;
  } else if (options.constructor == Object) {
    sourceMapPath = options.path || '';
    var aliases = options.aliases;
  } else if (options.constructor == String) {
    sourceMapPath = options;
  }

  readSourceMap(sourceMapPath, function(err, sourceMap) {
    if (err) {
      callback(prepareError(err, "can't load source map"));
      return;
    } else {
      maps[sourceMapPath] = {
        files: {},
        dirname: path.dirname(sourceMapPath)
      };

      if (aliases && aliases.constructor == Object) {
        maps[sourceMapPath].aliases = aliases;
      }

      var sources = sourceMap.sources;
      var timeToCallback = sources.length;
      for (var i = 0; i < sources.length; i++) {
        var filePath = sources[i];
        if (aliases && aliases[sources[i]]) {
          filePath = aliases[sources[i]];
        }
        readFile(sourceMapPath, filePath, function(err) {
          if (err) {
            delete maps[sourceMapPath];
            callback(prepareError(err, "can't find original source file"));
            return;
          } else {
            timeToCallback--;
            if (! timeToCallback) {
              maps[sourceMapPath].consumer = new sourceMapConsumer(sourceMap);

              callback(null);
            }
          }
        });
      }
    }
  });
};

function prepareError(err, msg) {
  err.name = 'Understack Error - ' + msg;
  return err;
}

function readSourceMap(sourceMapPath, callback) {
  fs.readFile(sourceMapPath, 'utf8', function(err, data) {
    if (err) {
      callback(err);
    } else {
      var json = JSON.parse(data);
      callback(null, json);
    }
  });
}

function readFile(sourceMap, filePath, callback) {
  var fullFilePath = path.join(maps[sourceMap].dirname, filePath);
  fs.readFile(fullFilePath, 'utf-8', function(err, data) {
    if (err) {
      callback(err);
    } else if (maps[sourceMap]) {
      maps[sourceMap].files[filePath] = data.split('\n');
      callback(null);
    }
  });
}

var readStackTrace = function(data, sourceMapPath, callback) {
  if (arguments.length == 2) {
    callback = sourceMapPath;
    sourceMapPath = Object.keys(maps)[0];
  }

  if (! maps[sourceMapPath]) {
    callback(null);
    return;
  }

  var stackTrace = data.split('\n');
  var errorMsg = stackTrace[0];
  var originStackTrace = [];
  originStackTrace.push(errorMsg);
  for (var i = 1; i < stackTrace.length; i++) {
    var r = stackTrace[i].match(/:(\d+):(\d+)/);
    if (r) {
      var line = Number(r[1]);
      var column = Number(r[2]);
      var originalLine = findPosition(line, column, sourceMapPath);
      originStackTrace.push(originalLine ? originalLine : stackTrace[i]);
    } else {
      originStackTrace.push(stackTrace[i]);
    }
  }
  callback(originStackTrace.join('\n'));
};

function findPosition(line, col, sourceMapPath) {
  var result = maps[sourceMapPath].consumer.originalPositionFor({
    line: line,
    column: col
  });
  if (! result.line) return;
  var filePath = checkAlias(sourceMapPath, result.source);
  var sourceFile = maps[sourceMapPath].files[filePath];
  var originalLine = sourceFile[result.line - 1].replace(/\t/g, '');

  return '    at ' + originalLine + ' (' + filePath + ':' + result.line + ':' + result.column + ')';
}

function checkAlias(sourceMapPath, filePath) {
  var map = maps[sourceMapPath];
  if (map && map.aliases && map.aliases[filePath]) {
    return map.aliases[filePath];
  } else {
    return filePath;
  }
}

module.exports.translate = readStackTrace;
module.exports.tr = readStackTrace;
module.exports.read = readStackTrace;
