#!/usr/bin/env node

const systemImageClient = require("./src/module.js").Client;
const systemImage = new systemImageClient();

var progress = (progress, speed) => {
  console.log("progress:", progress*100, "%");
  console.log("speed:", speed, "MB/s");
}

var next = (downloadedFiles, totalFiles) => {
  console.log("file", downloadedFiles, "/", totalFiles);
}

systemImage.downloadLatestVersion({device: "bacon", channel: "ubports-touch/16.04/stable"}, progress, next).then((files) => { console.log("done!"); console.log(files); });

// mainEvent.emit("download:pushReady", files);
