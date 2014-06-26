var sourceMapConsumer = require('source-map').SourceMapConsumer,
    fs = require('fs'),
    path = require('path'),
    maps = {};

module.exports.maps = function() {
  return Object.keys(maps);
};

module.exports.addSourceMap = function(options, callback) {
  var sourceMapPath;
  if (! options) {
    var err = new Error('UnderStack Error - invalid options');
    callback(err);
    return;
  } else if (options.constructor == Object) {
    sourceMapPath = options.path || '';
    var dirname = options.dirname;
  } else if (options.constructor == String) {
    sourceMapPath = options;
  }
  var mapName = path.basename(sourceMapPath);
  if (maps[mapName]) {
    callback(null);
    return;
  }

  readSourceMap(sourceMapPath, function(err, sourceMap) {
    if (err) {
      callback(prepareError(err, "can't load source map"));
      return;
    } else {
      maps[mapName] = {
        files: {}
      };

      var sources = sourceMap.sources;
      if (dirname) {
        maps[mapName].aliases = makeAliases(dirname, sources);
      }

      var aliases = maps[mapName].aliases;
      var timeToCallback = sources.length;
      for (var i = 0; i < sources.length; i++) {
        var filePath = sources[i];
        if (aliases && aliases[sources[i]]) {
          filePath = aliases[sources[i]];
        }
        readFile(mapName, filePath, function(err) {
          if (err) {
            delete maps[mapName];
            callback(prepareError(err, "can't find original source file"));
            return;
          } else {
            timeToCallback--;
            if (! timeToCallback) {
              maps[mapName].consumer = new sourceMapConsumer(sourceMap);
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

function readFile(mapName, filePath, callback) {
  fs.readFile(filePath, 'utf-8', function(err, data) {
    if (err) {
      callback(err);
    } else if (maps[mapName]) {
      maps[mapName].files[filePath] = data.split('\n');
      callback(null);
    }
  });
}

var readStackTrace = function(data, mapName, callback) {
  if (arguments.length == 2) {
    callback = mapName;
    mapName = Object.keys(maps)[0];
  }
  mapName = path.basename(mapName);

  if (! maps[mapName]) {
    callback(null);
    return;
  }

  var stackTrace = data.split('\n');
  var errorMsg = stackTrace[0];
  var originStackTrace = [];
  originStackTrace.push(errorMsg);
  for (var i = 1; i < stackTrace.length; i++) {
    var r = stackTrace[i].match(/:(\d+):(\d+)|(\d+$)/);
    if (r) {
      var line = Number(r[1]) || Number(r[3]);
      var column = Number(r[2]);
      var originalLine = findPosition(line, column, mapName);
      originStackTrace.push(originalLine ? originalLine : stackTrace[i]);
    } else {
      originStackTrace.push(stackTrace[i]);
    }
  }
  callback(originStackTrace.join('\n'));
};

function findPosition(line, col, mapName) {
  var result = maps[sourceMapPath].consumer.originalPositionFor({
    line: line,
    column: col
  });
  if (! result.line) return;
  var filePath = checkAlias(mapName, result.source);
  var sourceFile = maps[mapName].files[filePath];
  var originalLine = sourceFile[result.line - 1].replace(/\t/g, '');

  return '    at ' + originalLine + ' (' + filePath + ':' + result.line + ':' + result.column + ')';
}

function makeAliases(dirname, sources) {
  var aliases = {};
  for (var i = 0; i < sources.length; i++) {
    var filePath = sources[i];
    var fileName = path.basename(filePath);
    var newFileName = path.join(dirname, fileName);
    aliases[filePath] = newFileName;
  }
  return aliases;
}

function checkAlias(mapName, filePath) {
  var map = maps[mapName];
  if (map && map.aliases && map.aliases[filePath]) {
    return map.aliases[filePath];
  } else {
    return filePath;
  }
}

module.exports.translate = readStackTrace;
module.exports.tr = readStackTrace;
module.exports.read = readStackTrace;
