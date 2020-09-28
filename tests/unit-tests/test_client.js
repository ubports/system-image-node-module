"use strict";

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
const axios = require("axios");
const moxios = require("moxios");

const chai = require("chai");
const sinon = require("sinon");
var sinonChai = require("sinon-chai");
var expect = chai.expect;
chai.use(sinonChai);

const SystemImageClient = require("../../src/module.js").Client;
const channelJson = require("../test-data/normal-channels.json");
const baconIndexJson = require("../test-data/bacon-index.json");
const baconLatestVersionJson = require("../test-data/bacon-latest-version.json");
const commandfileJson = require("../test-data/commandfile.json");
const filesUrlsJson = require("../test-data/files-urls.json");

const time = () => Math.floor(new Date() / 1000);

describe("Client module", function() {
  describe("constructor()", function() {
    it("should create default client", function() {
      const sic = new SystemImageClient();
      expect(sic.host).to.eql("https://system-image.ubports.com/");
      expect(sic.path).to.eql("./test");
      expect(sic.cache_time).to.eql(180);
    });

    it("should create custom client", function() {
      const sic = new SystemImageClient({
        host: "https://system-image.example.com/",
        path: "./custom-test",
        cache_time: 240
      });
      expect(sic.host).to.eql("https://system-image.example.com/");
      expect(sic.path).to.eql("./custom-test");
      expect(sic.cache_time).to.eql(240);
    });

    it("should ensure trailing slash", function() {
      const sic = new SystemImageClient({
        host: "https://system-image.example.com"
      });
      expect(sic.host).to.eql("https://system-image.example.com/");
    });

    it("should return insecure error", function() {
      try {
        const sic = new SystemImageClient({
          host: "http://system-image.example.com/"
        });
      } catch (err) {
        expect(err.message).to.equal(
          "Insecure URL! Call with allow_insecure to ignore."
        );
      }
    });

    it("should ensure create insecure client", function() {
      const sic = new SystemImageClient({
        host: "http://system-image.example.com/",
        allow_insecure: true
      });
      expect(sic.host).to.eql("http://system-image.example.com/");
    });

    it("should return invalid url error", function() {
      try {
        const sic = new SystemImageClient({
          host: "definitely not a valid url"
        });
      } catch (err) {
        expect(err.message).to.equal("Host is not a valid URL!");
      }
    });

    it("should return invalid url with no host", function() {
      try {
        const sic = new SystemImageClient({
          path: "./custom-test",
          cache_time: 240
        });
      } catch (err) {
        expect(err.message).to.equals("Host is not a valid URL!");
      }
    });
  });

  describe("getChannelsIndex()", function() {
    it("should resolve channels index and store cache", function(done) {
      const sic = new SystemImageClient();
      const thenSpy = sinon.spy();
      const catchSpy = sinon.spy();
      expect(sic.channelsIndexCache).to.eql({ expire: 0 });
      sic
        .getChannelsIndex()
        .then(thenSpy)
        .catch(catchSpy);

      moxios.wait(function() {
        let request = moxios.requests.mostRecent();
        request
          .respondWith({
            status: 200,
            response: channelJson
          })
          .then(function() {
            try {
              expect(thenSpy).to.have.been.calledOnceWith(channelJson);
              expect(sic.channelsIndexCache.data).to.eql(channelJson);
              expect(thenSpy).to.not.have.been.calledTwice;
              expect(catchSpy).to.not.have.been.called;
              done();
            } catch (e) {
              done(`unfulfilled assertions: ${e}`);
            }
          });
      });
    });

    it("should use cache", function(done) {
      const sic = new SystemImageClient();
      sic.channelsIndexCache = {
        expire: time() + 180,
        data: "hello :)"
      };
      sic
        .getChannelsIndex()
        .then(r => {
          try {
            expect(r).to.eql("hello :)");
            done();
          } catch (e) {
            done(`unfulfilled assertions: ${e}`);
          }
        })
        .catch(e => done(`unfulfilled assertions: ${e}`));
    });

    it("cache should expire", function(done) {
      const sic = new SystemImageClient();
      sic.channelsIndexCache = {
        expire: time() - 180,
        data: "hello :)"
      };
      const thenSpy = sinon.spy();
      const catchSpy = sinon.spy();
      sic
        .getChannelsIndex()
        .then(thenSpy)
        .catch(catchSpy);

      moxios.wait(function() {
        let request = moxios.requests.mostRecent();
        request
          .respondWith({
            status: 200,
            response: channelJson
          })
          .then(function() {
            try {
              expect(thenSpy).to.have.been.calledOnceWith(channelJson);
              expect(sic.channelsIndexCache.data).to.eql(channelJson);
              expect(thenSpy).to.not.have.been.calledTwice;
              expect(catchSpy).to.not.have.been.called;
              done();
            } catch (e) {
              done(`unfulfilled assertions: ${e}`);
            }
          });
      });
    });
  });

  describe("getDeviceIndex()", function() {
    it("should resolve device index and store cache", function(done) {
      const sic = new SystemImageClient();
      const thenSpy = sinon.spy();
      const catchSpy = sinon.spy();
      expect(sic.deviceIndexCache).to.eql({});
      sic
        .getDeviceIndex("bacon", "ubports-touch/15.04/stable")
        .then(thenSpy)
        .catch(catchSpy);

      moxios.wait(function() {
        let request = moxios.requests.mostRecent();
        request
          .respondWith({
            status: 200,
            response: baconIndexJson
          })
          .then(function() {
            try {
              expect(thenSpy).to.have.been.calledOnceWith(baconIndexJson);
              expect(
                sic.deviceIndexCache["bacon"]["ubports-touch/15.04/stable"].data
              ).to.eql(baconIndexJson);
              expect(thenSpy).to.not.have.been.calledTwice;
              expect(catchSpy).to.not.have.been.called;
              done();
            } catch (e) {
              done(`unfulfilled assertions: ${e}`);
            }
          });
      });
    });

    it("should use cache", function(done) {
      const sic = new SystemImageClient();
      sic.deviceIndexCache.bacon = {
        "ubports-touch/15.04/stable": {
          expire: time() + 180,
          data: "hello :)"
        }
      };
      sic
        .getDeviceIndex("bacon", "ubports-touch/15.04/stable")
        .then(r => {
          try {
            expect(r).to.eql("hello :)");
            done();
          } catch (e) {
            done(`unfulfilled assertions: ${e}`);
          }
        })
        .catch(e => done(`unfulfilled assertions: ${e}`));
    });

    it("cache should expire", function(done) {
      const sic = new SystemImageClient();
      sic.deviceIndexCache.bacon = {
        "ubports-touch/15.04/stable": {
          expire: time() - 180,
          data: "hello :)"
        }
      };
      const thenSpy = sinon.spy();
      const catchSpy = sinon.spy();
      sic
        .getDeviceIndex("bacon", "ubports-touch/15.04/stable")
        .then(thenSpy)
        .catch(catchSpy);

      moxios.wait(function() {
        let request = moxios.requests.mostRecent();
        request
          .respondWith({
            status: 200,
            response: baconIndexJson
          })
          .then(function() {
            try {
              expect(thenSpy).to.have.been.calledOnceWith(baconIndexJson);
              expect(
                sic.deviceIndexCache["bacon"]["ubports-touch/15.04/stable"].data
              ).to.eql(baconIndexJson);
              expect(thenSpy).to.not.have.been.calledTwice;
              expect(catchSpy).to.not.have.been.called;
              done();
            } catch (e) {
              done(`unfulfilled assertions: ${e}`);
            }
          });
      });
    });
  });

  describe("createInstallCommands()", function() {
    it("should return install commands", function() {
      const sic = new SystemImageClient();
      var result = sic.createInstallCommands(
        baconLatestVersionJson.files,
        true,
        true,
        [1, 2, 3]
      );
      expect(result).to.eql(commandfileJson);
    });

    it("should return error commands", function() {
      const sic = new SystemImageClient();
      var result = sic.createInstallCommands(4, true, true, [1, 2, 3]);
      expect(result).to.eql(false);
    });

    it("should not add 'format data' when wipe === false", function() {
      const sic = new SystemImageClient();
      var result = sic.createInstallCommands(
        baconLatestVersionJson.files,
        true,
        false,
        true,
        [1, 2, 3]
      );
      expect(result).to.not.contain("\nformat data");
    });

    it("should not add 'enabled' when enable is set to false", function() {
      const sic = new SystemImageClient();
      var result = sic.createInstallCommands(
        baconLatestVersionJson.files,
        true,
        true,
        false,
        [1, 2, 3]
      );
      expect(result).to.not.contain("\nenable\n");
    });

    it("should not add 'installer_check' when installerCheck === false", function() {
      const sic = new SystemImageClient();
      var result = sic.createInstallCommands(
        baconLatestVersionJson.files,
        false,
        true,
        true,
        [1, 2, 3]
      );
      expect(result).to.not.contain("\ninstaller_check");
    });
  });

  describe("createInstallCommandsFile()", function() {
    it("should create install commands file", function() {
      const sic = new SystemImageClient();
      var file = sic.createInstallCommandsFile(commandfileJson, "bacon");
      expect(file.indexOf("test/system-image/ubuntu_command") != -1).to.eql(
        true
      );
      expect(fs.readFileSync(file).toString()).to.eql(commandfileJson);
    });
    // TODO introduce a test case with invalid input
  });

  describe("getReleaseDate()", function() {
    it("should resolve release date", function() {
      const sic = new SystemImageClient();
      sic.getDeviceIndex = sinon.fake.resolves(baconIndexJson);
      return sic
        .getReleaseDate("bacon", "ubports-touch/15.04/stable")
        .then(result => {
          expect(result).to.eql("Mon Dec 18 08:54:59 UTC 2017");
        });
    });
  });

  describe("getChannels()", function() {
    it("should resolve channels", function() {
      const sic = new SystemImageClient();
      sic.getChannelsIndex = sinon.fake.resolves(channelJson);
      return sic.getChannels().then(result => {
        expect(result).to.eql([
          "ubports-touch/15.04/devel",
          "ubports-touch/15.04/rc",
          "ubports-touch/15.04/stable",
          "ubports-touch/16.04/devel"
        ]);
      });
    });
  });

  describe("getDeviceChannels()", function() {
    it("should resolve device channels", function() {
      const sic = new SystemImageClient();
      sic.getChannelsIndex = sinon.fake.resolves(channelJson);
      return sic.getDeviceChannels("krillin").then(result => {
        expect(result).to.eql([
          "ubports-touch/15.04/devel",
          "ubports-touch/15.04/rc",
          "ubports-touch/15.04/stable"
        ]);
      });
    });
  });

  describe("getLatestVersion()", function() {
    it("should resolve latest version", function() {
      const sic = new SystemImageClient();
      sic.getDeviceIndex = sinon.fake.resolves(baconIndexJson);
      return sic
        .getLatestVersion("bacon", "ubports-touch/15.04/devel")
        .then(result => {
          expect(result).to.eql(baconLatestVersionJson);
        });
    });
    it("should reject if no images available", function(done) {
      const sic = new SystemImageClient();
      sic.getDeviceIndex = sinon.fake.resolves({});
      sic
        .getLatestVersion("bacon", "ubports-touch/15.04/devel")
        .catch(error => {
          expect(error.message).to.eql(
            "No images for bacon on channel ubports-touch/15.04/devel: {}"
          );
          done();
        });
    });
  });

  describe("getGgpUrlsArray()", function() {
    it("should return gpg urls array", function() {
      const sic = new SystemImageClient();
      expect(sic.getGgpUrlsArray()).to.eql([
        {
          path: "test/system-image/gpg/image-signing.tar.xz",
          url: "https://system-image.ubports.com/gpg/image-signing.tar.xz"
        },
        {
          path: "test/system-image/gpg/image-signing.tar.xz.asc",
          url: "https://system-image.ubports.com/gpg/image-signing.tar.xz.asc"
        },
        {
          path: "test/system-image/gpg/image-master.tar.xz",
          url: "https://system-image.ubports.com/gpg/image-master.tar.xz"
        },
        {
          path: "test/system-image/gpg/image-master.tar.xz.asc",
          url: "https://system-image.ubports.com/gpg/image-master.tar.xz.asc"
        }
      ]);
    });
  });

  describe("getFilesUrlsArray()", function() {
    it("should return files urls", function() {
      const sic = new SystemImageClient();
      expect(sic.getFilesUrlsArray(baconLatestVersionJson)).to.eql(
        filesUrlsJson
      );
    });
    it("should return error", function() {
      const sic = new SystemImageClient();
      try {
        sic.getFilesUrlsArray([]);
      } catch (err) {
        expect(err.message).to.eql(
          "Cannot read property 'forEach' of undefined"
        );
      }
    });
  });

  describe("getFilePushArray()", function() {
    it("should return files urls", function() {
      const sic = new SystemImageClient();
      expect(sic.getFilePushArray(filesUrlsJson)).to.eql(
        require("../test-data/file-push.json")
      );
    });
    it("should return error", function() {
      const sic = new SystemImageClient();
      try {
        sic.getFilePushArray([]);
      } catch (err) {
        expect(err.message).to.eql(
          "Cannot read property 'forEach' of undefined"
        );
      }
    });
  });
});
