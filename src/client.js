"use strict";

/*
 * Copyright (C) 2017-2018 Marius Gripsgard <marius@ubports.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const http = require("request");
const os = require("os");
const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const download = require("download");
const common = require("./common.js");

const time = () => Math.floor(new Date() / 1000);

const startCommands =
  "format system\n\
load_keyring image-master.tar.xz image-master.tar.xz.asc\n\
load_keyring image-signing.tar.xz image-signing.tar.xz.asc\n\
mount system";
const endCommands = "\nunmount system\n";
const DEFAULT_HOST = "https://system-image.ubports.com/";
const DEFAULT_CACHE_TIME = 180; // 3 minutes
const DEFAULT_PATH = "./test";
const ubuntuCommandFile = "ubuntu_command";
const ubuntuPushDir = "/cache/recovery/";
const gpg = [
  "image-signing.tar.xz",
  "image-signing.tar.xz.asc",
  "image-master.tar.xz",
  "image-master.tar.xz.asc"
];

/**
 * A class representing a Client connection
 * @class
 */
class Client {
  /**
   * @constructs Client
   * @param {Object} options
   */
  constructor(options) {
    this.host = DEFAULT_HOST;
    this.cache_time = DEFAULT_CACHE_TIME;
    this.path = DEFAULT_PATH;
    this.deviceIndexCache = {};
    this.channelsIndexCache = { expire: 0 };

    // accept options
    if (options) {
      if (options.host) {
        // validate URL
        if (
          options.host.match(
            /https?:\/\/(www\.)?[-a-z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-z0-9@:%_\+.~#?&//=]*)/i
          )
        ) {
          // ensure https
          if (!options.allow_insecure && options.host.includes("http://")) {
            throw new Error(
              "Insecure URL! Call with allow_insecure to ignore."
            );
          }
          // ensure trailing slash
          this.host = options.host + (options.host.slice(-1) != "/" ? "/" : "");
        } else {
          throw new Error("Host is not a valid URL!");
        }
      }
      if (options.path) {
        this.path = options.path;
      }
      if (options.cache_time) {
        this.cache_time = options.cache_time;
      }
    }
  }

  /**
   * Downloads the latest version
   * @param {Object} options - An object with the following structure:
   * {
   *   device     Codename of the device
   *   channel    Release channel to download
   *   wipe       Wipe memory
   * }
   * @param {function} progress
   * @param {function} next
   * @returns {Promise}
   */
  downloadLatestVersion(options, progress, next) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this
        .getLatestVersion(options.device, options.channel)
        .then(latest => {
          var urls = _this.getFilesUrlsArray(latest);
          urls.push.apply(urls, _this.getGgpUrlsArray());
          var filesDownloaded = 0;
          var overallSize = 0;
          var overallDownloaded = 0;
          var previousOverallDownloaded = 0;
          var downloadProgress = 0;
          var progressInterval = setInterval(() => {
            downloadProgress = overallDownloaded / overallSize;
            if (overallSize != 0) {
              if (downloadProgress < 0.999) {
                progress(
                  downloadProgress,
                  (overallDownloaded - previousOverallDownloaded) / 1000000
                );
                previousOverallDownloaded = overallDownloaded;
              } else {
                clearInterval(progressInterval);
                progress(1, 0);
              }
            }
          }, 1000);
          Promise.all(
            urls.map(file => {
              return new Promise(function(resolve, reject) {
                common
                  .checksumFile(file)
                  .then(() => {
                    next(++filesDownloaded, urls.length);
                    resolve();
                    return;
                  })
                  .catch(() => {
                    download(file.url, file.path)
                      .on("response", res => {
                        var totalSize = eval(res.headers["content-length"]);
                        overallSize += totalSize;
                        var downloaded = 0;
                        res.on("data", data => {
                          overallDownloaded += data.length;
                        });
                      })
                      .then(() => {
                        common
                          .checksumFile(file)
                          .then(() => {
                            next(++filesDownloaded, urls.length);
                            resolve();
                            return;
                          })
                          .catch(err => {
                            reject(err);
                            return;
                          });
                      })
                      .catch(err => {
                        reject(err);
                        return;
                      });
                  });
              });
            })
          )
            .then(() => {
              var files = _this.getFilePushArray(urls);
              files.push({
                src: _this.createInstallCommandsFile(
                  _this.createInstallCommands(
                    latest.files,
                    options.installerCheck,
                    options.wipe,
                    options.enable
                  ),
                  options.device
                ),
                dest: ubuntuPushDir + ubuntuCommandFile
              });
              resolve(files);
              return;
            })
            .catch(e => reject("Download failed: " + e));
        })
        .catch(e => reject("Can't find latest version: " + e));
    });
  }

  /**
   * Create the install commands
   * @param {Array} files - A list of files
   * @param {function} installerCheck
   * @param {boolean} wipe
   * @param {Array} enable
   * @returns {String} - A list of commands
   */
  createInstallCommands(files, installerCheck, wipe, enable) {
    var cmd = startCommands;
    if (wipe === true) cmd += "\nformat data";
    if (files.constructor !== Array) return false;
    files.forEach(file => {
      cmd +=
        "\nupdate " +
        path.basename(file.path) +
        " " +
        path.basename(file.signature);
    });
    if (enable) {
      if (enable.constructor === Array) {
        enable.forEach(en => {
          cmd += "\nenable " + en;
        });
      }
    }
    cmd += endCommands;
    if (installerCheck) cmd += "\ninstaller_check";
    return cmd;
  }

  /**
   * Write the install commands into a file
   * @param {String} cmds - A list of commands
   * @param {String} device
   * @returns {String} - A path to the file
   */
  createInstallCommandsFile(cmds, device) {
    if (!fs.existsSync(path.join(this.path, "commandfile"))) {
      mkdirp.sync(path.join(this.path, "commandfile"));
    }
    var file = path.join(
      this.path,
      "commandfile",
      ubuntuCommandFile + device + common.getRandomInt(1000, 9999)
    );
    fs.writeFileSync(file, cmds);
    return file;
  }

  /**
   * Function to retrieve the data from cache, if index is expired information is retrieved from a HTTP call
   * @returns {Promise} - A promise that resolves with the current data
   */
  getChannelsIndex() {
    const _this = this;
    return new Promise(function(resolve, reject) {
      var now = time();
      if (_this.channelsIndexCache && _this.channelsIndexCache.expire > now)
        return resolve(_this.channelsIndexCache.data);
      http.get(
        {
          url: _this.host + "channels.json",
          json: true
        },
        (err, res, bod) => {
          if (err || res.statusCode !== 200) {
            reject(err);
            return;
          }
          _this.channelsIndexCache.data = bod;
          _this.channelsIndexCache.expire = time() + _this.cache_time;
          resolve(_this.channelsIndexCache.data);
        }
      );
    });
  }

  /**
   * Retrieves the index of a device in a channel, performs an HTTP request if the cache is expired
   * @param {String} device - Name of the device
   * @param {String} channel - Name of the channel
   * @returns {Promise} - Promise resolves with the index for a given device and channel
   */
  getDeviceIndex(device, channel) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      var now = time();
      if (
        _this.deviceIndexCache[device] &&
        _this.deviceIndexCache[device][channel] &&
        _this.deviceIndexCache[device][channel].expire > now
      )
        return resolve(_this.deviceIndexCache[device][channel].data);
      http.get(
        {
          url: _this.host + channel + "/" + device + "/index.json",
          json: true
        },
        (err, res, bod) => {
          if (err || res.statusCode !== 200) {
            reject(err);
            return;
          }
          if (!_this.deviceIndexCache[device])
            _this.deviceIndexCache[device] = {};
          _this.deviceIndexCache[device][channel] = {};
          _this.deviceIndexCache[device][channel].data = bod;
          _this.deviceIndexCache[device][channel].expire =
            time() + _this.cache_time;
          resolve(_this.deviceIndexCache[device][channel].data);
        }
      );
    });
  }

  /**
   * Retrieves the release date of a device in a channel.
   * @param {String} device - Name of the device
   * @param {String} channel - Name of the channel
   * @returns {Promise} - Promise resolves with the date if was generated at for a given device and channel
   */
  getReleaseDate(device, channel) {
    return this.getDeviceIndex(device, channel).then(deviceIndex => {
      return deviceIndex.global.generated_at;
    });
  }

  /**
   * Retrieves a list of channels.
   * @returns {Promise} - Promise resolves with the list of channels
   */
  getChannels() {
    return this.getChannelsIndex().then(_channels => {
      var channels = [];
      for (var channel in _channels) {
        if (_channels[channel].hidden || _channels[channel].redirect) continue;
        channels.push(channel);
      }
      return channels;
    });
  }

  /**
   * Retrieves a list of channels for a device.
   * @param {String} device - Name of the device
   * @returns {Promise} - Promise resolves with the list of channels for a given device
   */
  getDeviceChannels(device) {
    return this.getChannelsIndex().then(channels => {
      var deviceChannels = [];
      for (var channel in channels) {
        if (channels[channel].hidden || channels[channel].redirect) continue;
        if (device in channels[channel]["devices"]) {
          deviceChannels.push(channel);
        }
      }
      return deviceChannels;
    });
  }

  /**
   * Retrieves a list of channels.
   * @param {String} device - Name of the device
   * @param {String} channel - Name of the channel
   * @returns {Promise} - Promise resolves with the latest version from the images
   */
  getLatestVersion(device, channel) {
    return this.getDeviceIndex(device, channel).then(index => {
      //TODO optimize with searching in reverse, but foreach is safer
      // to use now to be sure we get latest version
      var latest = false;
      index.images.forEach(img => {
        if (img.type === "full" && (!latest || latest.version < img.version)) {
          latest = img;
        }
      });
      return latest;
    });
  }

  /**
   * Getter for retrieving GPG URLs
   * @returns {Array} - Returns an array of GPG URLs
   */
  getGgpUrlsArray() {
    var gpgUrls = [];
    gpg.forEach(g => {
      gpgUrls.push({
        url: this.host + "gpg/" + g,
        path: path.join(this.path, "gpg")
      });
    });
    return gpgUrls;
  }

  /**
   * Getter for retrieving File URLs
   * @returns {Array} - Returns an array of URLs for the files
   */
  getFilesUrlsArray(index) {
    var ret = [];
    index.files.forEach(file => {
      ret.push({
        url: this.host + file.path,
        path: path.join(this.path, "pool"),
        checksum: file.checksum
      });
      ret.push({
        url: this.host + file.signature,
        path: path.join(this.path, "pool")
      });
    });
    return ret;
  }

  /**
   * Adds urls to the file and returns it
   * @returns {Array} - Returns an array of files with the new urls added to it
   */
  getFilePushArray(urls) {
    var files = [];
    urls.forEach(url => {
      files.push({
        src: path.join(url.path, path.basename(url.url)),
        dest: ubuntuPushDir
      });
    });
    return files;
  }
}

module.exports = Client;
