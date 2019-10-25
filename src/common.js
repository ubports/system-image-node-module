/*
 * Copyright (C) 2017 Marius Gripsgard <marius@ubports.com>
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

const fs = require("fs");
const checksum = require("checksum");
const path = require("path");

/**
 * Returns a random integer between a minimum and a maximum.
 * @param {int} min - The minimum value.
 * @param {int} max - The maximum value.
 * @returns {int} - The random integer
 */
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * Performs a checksum if exists and returns true if it passes
 * @param {int} min - The minimum value.
 * @param {int} max - The maximum value.
 * @returns {Promise} - Promise that is resolved if there is no checksum or if the checksum is valid
 */
function checksumFile(file) {
  return new Promise(function(resolve, reject) {
    fs.access(path.join(file.path, path.basename(file.url)), err => {
      if (err) {
        reject(err);
      } else {
        if (!file.checksum) {
          // No checksum so return true;
          resolve();
          return;
        } else {
          checksum.file(
            path.join(file.path, path.basename(file.url)),
            {
              algorithm: "sha256"
            },
            function(err, sum) {
              console.log(
                "checked: " + path.basename(file.url),
                sum === file.checksum
              );
              if (sum === file.checksum) resolve();
              else reject();
            }
          );
        }
      }
    });
  });
}

/**
 * A module that contains methods common for server and client
 * @module common
 */
module.exports = {
  getRandomInt: getRandomInt,
  checksumFile: checksumFile
};
