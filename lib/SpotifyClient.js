"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _typeof2 = _interopRequireDefault(require("@babel/runtime/helpers/typeof"));

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var _possibleConstructorReturn2 = _interopRequireDefault(require("@babel/runtime/helpers/possibleConstructorReturn"));

var _getPrototypeOf2 = _interopRequireDefault(require("@babel/runtime/helpers/getPrototypeOf"));

var _inherits2 = _interopRequireDefault(require("@babel/runtime/helpers/inherits"));

var _request = _interopRequireDefault(require("request"));

var _events = require("events");

var _util = require("util");

var _toCamelCase = _interopRequireDefault(require("./utils/toCamelCase"));

var SpotifyClient =
/*#__PURE__*/
function (_EventEmitter) {
  (0, _inherits2["default"])(SpotifyClient, _EventEmitter);

  /**
   * Creates a new Spotify Client
   * @class
   * @param {object} options
   * @param {string} options.clientId Spotify Client Id
   * @param {string} options.clientSecret Spotify Client Secret
   * @param {string} [options.refreshToken=null] Spotify User Refresh Token
   * @param {string} [options.redirectUri=null] Spotify Redirect URI
   * @param {string} [options.listenForPlaybackChanges=false] Option that enables checking for
   *  song playback changes, defaults to false
   */
  function SpotifyClient(options) {
    var _this;

    (0, _classCallCheck2["default"])(this, SpotifyClient);
    _this = (0, _possibleConstructorReturn2["default"])(this, (0, _getPrototypeOf2["default"])(SpotifyClient).call(this));
    _this.clientId = options.clientId;
    _this.clientSecret = options.clientSecret;
    _this.refreshToken = options.refreshToken || null;
    _this.redirectUri = options.redirectUri || null;
    _this.listenForPlaybackChanges = options.listenForPlaybackChanges || false;
    _this.scopes = '';
    _this.accessToken = null;
    _this.tokenExpireTime = 0;
    _this.lastTokenRefreshTime = 0;
    _this.useCamelCaseParser = true;
    _this.toCamelCase = _toCamelCase["default"];
    _this.request = (0, _util.promisify)(_request["default"]);
    _this.headers = {
      client: {
        Authorization: "Basic ".concat(Buffer.from("".concat(_this.clientId, ":").concat(_this.clientSecret)).toString('base64')),
        Accept: 'application/json'
      },
      user: {
        Accept: 'application/json'
      }
    };
    _this.currentTrack = null;
    _this.lastTrack = null;
    if (_this.listenForPlaybackChanges) _this.startPlaybackStateChangeListener();
    return _this;
  }
  /**
   * @param {string} query Search Query
   * @param {string} type Type of item to search for ['track', 'artist', 'album', 'playlist']
   */


  (0, _createClass2["default"])(SpotifyClient, [{
    key: "getSpotifyUri",
    value: async function getSpotifyUri(query, type) {
      await this.refreshAccessToken();
      var types = ['album', 'artist', 'playlist', 'track'];
      if (!query || typeof query !== 'string') throw new Error('Invalid query specified.');
      if (!types.includes(type)) throw new Error('Invalid type specified.');

      var _ref = await this.request("https://api.spotify.com/v1/search?q=".concat(query, "&type=").concat(type), {
        headers: this.headers.user,
        json: true
      }),
          body = _ref.body;

      var parsed = this.toCamelCase(body);
      var error = parsed.error;
      if (error) throw new Error(error.message);
      var items = parsed["".concat(type, "s")].items;
      return items[0].uri;
    }
    /**
     * @param {string} id Spotify ID for item
     * @param {string} type Type of item ['track', 'artist', 'album', 'playlist']
     */

  }, {
    key: "isValidSpotifyId",
    value: async function isValidSpotifyId(id, type) {
      await this.refreshAccessToken();
      var types = ['album', 'artist', 'playlist', 'track'];
      if (!types.includes(type)) throw new Error('Invalid type specified.');

      var _ref2 = await this.request("https://api.spotify.com/v1/".concat(type, "s}/").concat(id), {
        headers: this.headers.user,
        json: true
      }),
          body = _ref2.body;

      var parsed = this.toCamelCase(body);
      var error = parsed.error;
      return !error;
    }
    /**
     * @param {object} scopes An array of OAuth scopes
     */

  }, {
    key: "getOAuthUri",
    value: function getOAuthUri(scopes) {
      if ((0, _typeof2["default"])(scopes) === 'object' && scopes.length) this.scopes = scopes.join(' ');else this.scopes = scopes;
      this.scopes = encodeURIComponent(this.scopes);
      return "https://accounts.spotify.com/authorize?response_type=code&client_id=".concat(this.clientId, "&scope=").concat(this.scopes, "&redirect_uri=").concat(encodeURIComponent(this.redirectUri));
    }
    /**
     * @param {string} code Code returned after successful OAuth authentication
     */

  }, {
    key: "getRefreshToken",
    value: async function getRefreshToken(code) {
      var _ref3 = await this.request('https://accounts.spotify.com/api/token', {
        method: 'POST',
        form: {
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.redirectUri
        },
        json: true,
        headers: this.headers.client
      }),
          body = _ref3.body;

      var parsed = this.toCamelCase(body);
      var error = parsed.error,
          errorDescription = parsed.errorDescription,
          refreshToken = parsed.refreshToken,
          accessToken = parsed.accessToken,
          expiresIn = parsed.expiresIn;
      if (error) throw new Error(errorDescription);
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      this.tokenExpireTime = expiresIn * 1000;
      this.lastTokenRefreshTime = Date.now();
      this.headers.user.Authorization = "Bearer ".concat(this.accessToken);
      return {
        refreshToken: refreshToken,
        accessToken: accessToken,
        expiresIn: expiresIn
      };
    }
  }, {
    key: "refreshAccessToken",
    value: async function refreshAccessToken() {
      if (Date.now() <= this.lastTokenRefreshTime + this.tokenExpireTime) return this.accessToken;

      var _ref4 = await this.request('https://accounts.spotify.com/api/token', {
        method: 'POST',
        form: {
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token'
        },
        json: true,
        headers: this.headers.client
      }),
          body = _ref4.body;

      var parsed = this.toCamelCase(body);
      var error = parsed.error,
          errorDescription = parsed.errorDescription,
          accessToken = parsed.accessToken,
          expiresIn = parsed.expiresIn;
      if (error) throw new Error(errorDescription);
      this.lastTokenRefreshTime = Date.now();
      this.tokenExpireTime = expiresIn * 1000;
      this.accessToken = accessToken;
      this.headers.user.Authorization = "Bearer ".concat(this.accessToken);
      return accessToken;
    }
    /**
     * Get user information
     */

  }, {
    key: "getUserData",
    value: async function getUserData() {
      await this.refreshAccessToken();

      var _ref5 = await this.request('https://api.spotify.com/v1/me', {
        headers: this.headers.user,
        json: true
      }),
          body = _ref5.body;

      var parsed = this.toCamelCase(body);
      var error = parsed.error;
      if (error) throw new Error(error.message);
      return parsed;
    }
    /**
     * Get a users current track
     */

  }, {
    key: "getCurrentTrack",
    value: async function getCurrentTrack() {
      await this.refreshAccessToken();

      var _ref6 = await this.request('https://api.spotify.com/v1/me/player', {
        headers: this.headers.user,
        json: true
      }),
          body = _ref6.body;

      var parsed = this.toCamelCase(body);
      if (parsed && parsed.error) throw new Error(parsed.error.message);
      return parsed || null;
    }
    /**
     * Get a users recently played tracks
     */

  }, {
    key: "getRecentlyPlayedTracks",
    value: async function getRecentlyPlayedTracks() {
      var _this2 = this;

      var url = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
      await this.refreshAccessToken();

      var _ref7 = await this.request(url || 'https://api.spotify.com/v1/me/player/recently-played', {
        headers: this.headers.user,
        json: true
      }),
          body = _ref7.body;

      var parsed = this.toCamelCase(body);
      var error = parsed.error,
          next = parsed.next,
          items = parsed.items;
      if (parsed && parsed.error) throw new Error(error.message);

      var getNextPage = function getNextPage() {
        if (!next) return null;
        return _this2.getRecentlyPlayedTracks(next);
      };

      return {
        items: items,
        getNextPage: getNextPage
      } || null;
    }
    /**
     * @param {string} id ID of item
     * @param {string} type Type of item ['track', 'artist', 'album', 'playlist']
     */

  }, {
    key: "getItemWithId",
    value: async function getItemWithId(id, type) {
      await this.refreshAccessToken();
      var types = ['album', 'artist', 'playlist', 'track'];
      if (!types.includes(type)) throw new Error('Invalid type specified.');

      var _ref8 = await this.request("https://api.spotify.com/v1/".concat(type, "s/").concat(id), {
        json: true,
        headers: this.headers.user
      }),
          body = _ref8.body;

      var parsed = this.toCamelCase(body);
      var error = parsed.error;
      if (error) throw new Error(error.message);
      return parsed;
    }
    /**
     * @param {string} id ID of item
     */

  }, {
    key: "getTrackWithId",
    value: async function getTrackWithId(id) {
      await this.getItemWithId(id, 'track');
    }
    /**
     * @param {string} id ID of item
     */

  }, {
    key: "getArtistWithId",
    value: async function getArtistWithId(id) {
      await this.getItemWithId(id, 'artist');
    }
    /**
     * @param {string} id ID of item
     */

  }, {
    key: "getAlbumWithId",
    value: async function getAlbumWithId(id) {
      await this.getItemWithId(id, 'album');
    }
    /**
     * @param {string} id ID of item
     */

  }, {
    key: "getPlaylistWithId",
    value: async function getPlaylistWithId(id) {
      await this.getItemWithId(id, 'playlist');
    }
    /**
     * @param {string} item Item to get, accepts Spotify URI, open.spotify URI,
     * api.spotify URI, item name, item ID
     * @param {*} type Type of item ['track', 'artist', 'album', 'playlist']
     */

  }, {
    key: "getItem",
    value: async function getItem(item, type) {
      if (item.startsWith("spotify:".concat(type, ":"))) {
        var res = await this.getItemWithId(item.split("spotify:".concat(type, ":")).pop(), type);
        return res;
      }

      if (item.startsWith("https://api.spotify.com/v1/".concat(item, "s/"))) {
        var _res = await this.getItemWithId(item.split("https://api.spotify.com/v1/".concat(item, "s/")).pop(), type);

        return _res;
      }

      if (item.startsWith("https://open.spotify.com/v1/".concat(item, "s/"))) {
        var _res2 = await this.getItemWithId(item.split("https://open.spotify.com/v1/".concat(item, "s/")).pop(), type);

        return _res2;
      }

      try {
        var _res3 = await this.getItemWithId(item, type);

        return _res3;
      } catch (e) {
        var uri = await this.getSpotifyUri(item, type);

        var _res4 = await this.getItemWithId(uri.split("spotify:".concat(type, ":")).pop(), type);

        return _res4;
      }
    }
  }, {
    key: "getTrack",
    value: async function getTrack(track) {
      await this.getItem(track, 'track');
    }
  }, {
    key: "getTrackAudioAnalysis",
    value: async function getTrackAudioAnalysis(track) {
      await this.refreshAccessToken();
      var trackObject = await this.getTrack(track);

      var _ref9 = await this.request("https://api.spotify.com/v1/audio-analysis/".concat(trackObject.id), {
        headers: this.headers.user,
        json: true
      }),
          body = _ref9.body;

      var parsed = this.toCamelCase(body);
      var error = parsed.error;
      if (error) throw new Error(error.message);
      return parsed;
    }
  }, {
    key: "getArtist",
    value: async function getArtist(artist) {
      await this.getItem(artist, 'artist');
    }
  }, {
    key: "getAlbum",
    value: async function getAlbum(album) {
      await this.getItem(album, 'album');
    }
  }, {
    key: "getPlaylist",
    value: async function getPlaylist(playlist) {
      await this.getItem(playlist, 'playlist');
    }
  }, {
    key: "createPlaylist",
    value: async function createPlaylist(_ref10) {
      var name = _ref10.name,
          _ref10$isPublic = _ref10.isPublic,
          isPublic = _ref10$isPublic === void 0 ? true : _ref10$isPublic,
          _ref10$description = _ref10.description,
          description = _ref10$description === void 0 ? null : _ref10$description,
          _ref10$isCollaborativ = _ref10.isCollaborative,
          isCollaborative = _ref10$isCollaborativ === void 0 ? false : _ref10$isCollaborativ;
      await this.refreshAccessToken();

      var _ref11 = await this.getUserData(),
          id = _ref11.id;

      var _ref12 = await this.request("https://api.spotify.com/v1/users/".concat(id, "/playlists"), {
        method: 'POST',
        headers: this.headers.user,
        json: {
          name: name,
          "public": isPublic,
          collaborative: isCollaborative,
          description: description
        }
      }),
          body = _ref12.body;

      var parsed = this.toCamelCase(body);
      var error = parsed.error;
      if (error) throw new Error(error.message);
      return parsed;
    }
  }, {
    key: "listPlaylists",
    value: async function listPlaylists() {
      var _this3 = this;

      var page = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
      var limit = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 20;
      await this.refreshAccessToken();

      var _ref13 = await this.request("https://api.spotify.com/v1/me/playlists?offset=".concat((page - 1) * limit, "&limit=").concat(limit), {
        headers: this.headers.user,
        json: true
      }),
          body = _ref13.body;

      var parsed = this.toCamelCase(body);
      var error = parsed.error,
          items = parsed.items,
          next = parsed.next;
      if (error) throw new Error(error);

      var getPage = function getPage(pageNumber) {
        return _this3.listPlaylists(pageNumber, limit);
      };

      var getNextPage = function getNextPage() {
        if (!next) return null;
        return _this3.listPlaylists(page + 1, limit);
      };

      if (!items.length) return null;
      return {
        items: items,
        getNextPage: getNextPage,
        getPage: getPage
      };
    }
  }, {
    key: "startPlaybackStateChangeListener",
    value: function startPlaybackStateChangeListener() {
      var _this4 = this;

      this.playbackStateChangeListener = setInterval(async function () {
        await _this4.refreshAccessToken();
        var playbackData = await _this4.getCurrentTrack();
        if (!playbackData) return;

        if (!playbackData.item) {
          if (_this4.currentTrack) _this4.lastTrack = _this4.currentTrack;
          _this4.currentTrack = null;
          return;
        }

        if (!_this4.currentTrack) {
          _this4.currentTrack = playbackData;

          _this4.emit('newTrack', _this4.currentTrack);
        }

        if (playbackData.item.name !== _this4.currentTrack.item.name) {
          _this4.lastTrack = _this4.currentTrack;
          _this4.currentTrack = playbackData;
          if (_this4.lastTrack.progressMs <= _this4.lastTrack.item.durationMs - 5000) _this4.emit('trackSkipped', _this4.lastTrack);

          _this4.emit('newTrack', _this4.currentTrack);
        }

        if (playbackData.item.name === _this4.currentTrack.item.name) _this4.currentTrack = playbackData;
      }, 1000);
    }
  }]);
  return SpotifyClient;
}(_events.EventEmitter);

exports["default"] = SpotifyClient;