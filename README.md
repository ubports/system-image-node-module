# System image node module

[![Build Status](https://travis-ci.org/ubports/system-image-node-module.svg?branch=master)](https://travis-ci.org/ubports/system-image-node-module) [![Coverage Status](https://coveralls.io/repos/github/ubports/system-image-node-module/badge.svg?branch=master)](https://coveralls.io/github/ubports/system-image-node-module?branch=master)

**NOTE**: This library has been deprecated in favor of a smaller client integrated into the UBports Installer as a plugin in [0.8.6-beta](https://github.com/ubports/ubports-installer/releases/tag/0.8.6-beta). It will recieve no further development and is kept for archive purposes only.

## Client
Access a system-image server http endpoint

Example:

```javascript

const systemImageClient = require("./src/module.js").Client;
const systemImage = new systemImageClient();

systemImage.getDeviceChannels("bacon").then((channels) => console.log(channels));

const progress = (progress, speed) => {
  console.log("progress:", progress*100, "%");
  console.log("speed:", speed, "MB/s");
}

const next = (downloadedFiles, totalFiles) => {
  console.log("file", downloadedFiles, "/", totalFiles);
}

systemImage.downloadLatestVersion({device: "bacon", channel: "ubports-touch/16.04/stable"}, progress, next).then(() => { console.log("done"); });
```

The constructor takes an object with optional properties as an argument. The default properties are listed below.

```javascript
{
  host: "https://system-image.ubports.com/", // URL of the system-image server
  path: "./test",                            // download path
  allow_insecure: false                      // allow unencrypted URL
  cache_time: 180                            // time to keep cached files
}
```

## Server
Maintain a system-image server backend (not implemented yet)

## License

Original development by [Marius Gripsgård](http://mariogrip.com/) and [Jan Sprinz](https://spri.nz). Copyright (C) 2017-2021 [UBports Foundation](https://ubports.com).

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see <http://www.gnu.org/licenses/>.
