import request from 'request';
import { EventEmitter } from 'events';
import { promisify } from 'util';

export default class SpotifyClient extends EventEmitter {
  constructor(options) {
    super();

    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.refreshToken = options.refreshToken || null;
    this.redirectUri = options.redirectUri || null;
    this.listenForPlaybackChanges = options.listenForPlaybackChanges || false;

    this.scopes = '';
    this.accessToken = null;
    this.tokenExpireTime = 0;
    this.lastTokenRefreshTime = 0;
    this.useCamelCaseParser = true;

    this.request = promisify(request);

    this.headers = {
      client: {
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        Accept: 'application/json',
      },
      user: {
        Accept: 'application/json',
      },
    };

    this.currentTrack = null;
    this.lastTrack = null;

    if (this.listenForPlaybackChanges) this.startPlaybackStateChangeListener();
  }

  /**
   * @param {object} object Object to convert properties to camel case.
   */
  toCamelCase(object) {
    if (typeof object !== 'object' || object.length) return object;
    if (!this.useCamelCaseParser) return object;

    const newObject = {};

    Object.keys(object).forEach((k) => {
      const split = k.split('_');
      const newName = split.length >= 2 ? `${split[0]}${split[1][0].toUpperCase()}${split[1].substring(1, split[1].length)}` : k;

      if (typeof object[k] === 'object' && object[k] && !object[k].length) {
        newObject[newName] = this.toCamelCase(object[k]);
      } else if (typeof object[k] === 'object' && object[k] && object[k].length) {
        newObject[newName] = object[k].map((i) => {
          if (typeof i === 'object') return this.toCamelCase(i);

          return i;
        });
      } else {
        newObject[newName] = object[k];
      }
    });

    return newObject;
  }

  /**
   * @param {string} query Search Query
   * @param {string} type Type of item to search for ['track', 'artist', 'album', 'playlist']
   */
  async getSpotifyUri(query, type) {
    await this.refreshAccessToken();

    const types = ['album', 'artist', 'playlist', 'track'];

    if (!query || typeof query !== 'string') throw new Error('Invalid query specified.');
    if (!types.includes(type)) throw new Error('Invalid type specified.');

    const { body } = await this.request(`https://api.spotify.com/v1/search?q=${query}&type=${type}`, {
      headers: this.headers.user,
      json: true,
    });

    const parsed = this.toCamelCase(body);

    const { error } = parsed;

    if (error) throw new Error(error.message);

    const { items } = parsed[`${type}s`];

    return items[0].uri;
  }

  /**
   * @param {string} id Spotify ID for item
   * @param {string} type Type of item ['track', 'artist', 'album', 'playlist']
   */
  async isValidSpotifyId(id, type) {
    await this.refreshAccessToken();

    const types = ['album', 'artist', 'playlist', 'track'];

    if (!types.includes(type)) throw new Error('Invalid type specified.');

    const { body } = await this.request(`https://api.spotify.com/v1/${type}s}/${id}`, {
      headers: this.headers.user,
      json: true,
    });

    const parsed = this.toCamelCase(body);

    const { error } = parsed;

    return !error;
  }

  /**
   * @param {object} scopes An array of OAuth scopes
   */
  getOAuthUri(scopes) {
    if (typeof scopes === 'object' && scopes.length) this.scopes = scopes.join(' ');
    else this.scopes = scopes;

    this.scopes = encodeURIComponent(this.scopes);

    return `https://accounts.spotify.com/authorize?response_type=code&client_id=${this.clientId}&scope=${this.scopes}&redirect_uri=${encodeURIComponent(this.redirectUri)}`;
  }

  /**
   * @param {string} code Code returned after successful OAuth authentication
   */
  async getRefreshToken(code) {
    const { body } = await this.request('https://accounts.spotify.com/api/token', {
      method: 'POST',
      form: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
      },
      json: true,
      headers: this.headers.client,
    });

    const parsed = this.toCamelCase(body);

    const {
      error,
      errorDescription,
      refreshToken,
      accessToken,
      expiresIn,
    } = parsed;

    if (error) throw new Error(errorDescription);

    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.tokenExpireTime = expiresIn * 1000;
    this.lastTokenRefreshTime = Date.now();
    this.headers.user.Authorization = `Bearer ${this.accessToken}`;

    return {
      refreshToken,
      accessToken,
      expiresIn,
    };
  }

  async refreshAccessToken() {
    if (Date.now() <= this.lastTokenRefreshTime + this.tokenExpireTime) return this.accessToken;

    const { body } = await this.request('https://accounts.spotify.com/api/token', {
      method: 'POST',
      form: {
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      },
      json: true,
      headers: this.headers.client,
    });

    const parsed = this.toCamelCase(body);

    const {
      error,
      errorDescription,
      accessToken,
      expiresIn,
    } = parsed;

    if (error) throw new Error(errorDescription);

    this.lastTokenRefreshTime = Date.now();
    this.tokenExpireTime = expiresIn * 1000;
    this.accessToken = accessToken;
    this.headers.user.Authorization = `Bearer ${this.accessToken}`;

    return accessToken;
  }

  async getUserData() {
    await this.refreshAccessToken();

    const { body } = await this.request('https://api.spotify.com/v1/me', {
      headers: this.headers.user,
      json: true,
    });

    const parsed = this.toCamelCase(body);

    const { error } = parsed;

    if (error) throw new Error(error.message);

    return parsed;
  }

  async getCurrentTrack() {
    await this.refreshAccessToken();

    const { body } = await this.request('https://api.spotify.com/v1/me/player', {
      headers: this.headers.user,
      json: true,
    });

    const parsed = this.toCamelCase(body);

    if (parsed && parsed.error) throw new Error(parsed.error.message);

    return parsed || null;
  }

  async getRecentlyPlayedTracks(url = null) {
    await this.refreshAccessToken();

    const { body } = await this.request(url || 'https://api.spotify.com/v1/me/player/recently-played', {
      headers: this.headers.user,
      json: true,
    });

    const parsed = this.toCamelCase(body);

    const { error, next, items } = parsed;

    if (parsed && parsed.error) throw new Error(error.message);

    const getNextPage = () => {
      if (!next) return null;

      return this.getRecentlyPlayedTracks(next);
    };

    return {
      items,
      getNextPage,
    } || null;
  }

  /**
   * @param {string} id ID of item
   * @param {string} type Type of item ['track', 'artist', 'album', 'playlist']
   */
  async getItemWithId(id, type) {
    await this.refreshAccessToken();

    const types = ['album', 'artist', 'playlist', 'track'];

    if (!types.includes(type)) throw new Error('Invalid type specified.');

    const { body } = await this.request(`https://api.spotify.com/v1/${type}s/${id}`, {
      json: true,
      headers: this.headers.user,
    });

    const parsed = this.toCamelCase(body);

    const { error } = parsed;

    if (error) throw new Error(error.message);

    return parsed;
  }

  /**
   * @param {string} id ID of item
   */
  async getTrackWithId(id) {
    await this.getItemWithId(id, 'track');
  }

  /**
   * @param {string} id ID of item
   */
  async getArtistWithId(id) {
    await this.getItemWithId(id, 'artist');
  }

  /**
   * @param {string} id ID of item
   */
  async getAlbumWithId(id) {
    await this.getItemWithId(id, 'album');
  }

  /**
   * @param {string} id ID of item
   */
  async getPlaylistWithId(id) {
    await this.getItemWithId(id, 'playlist');
  }

  /**
   * @param {string} item Item to get, accepts Spotify URI, open.spotify URI,
   * api.spotify URI, item name, item ID
   * @param {*} type Type of item ['track', 'artist', 'album', 'playlist']
   */
  async getItem(item, type) {
    if (item.startsWith(`spotify:${type}:`)) {
      const res = await this.getItemWithId(item.split(`spotify:${type}:`).pop(), type);

      return res;
    }

    if (item.startsWith(`https://api.spotify.com/v1/${item}s/`)) {
      const res = await this.getItemWithId(item.split(`https://api.spotify.com/v1/${item}s/`).pop(), type);

      return res;
    }

    if (item.startsWith(`https://open.spotify.com/v1/${item}s/`)) {
      const res = await this.getItemWithId(item.split(`https://open.spotify.com/v1/${item}s/`).pop(), type);

      return res;
    }

    try {
      const res = await this.getItemWithId(item, type);

      return res;
    } catch (e) {
      const uri = await this.getSpotifyUri(item, type);
      const res = await this.getItemWithId(uri.split(`spotify:${type}:`).pop(), type);

      return res;
    }
  }

  async getTrack(track) {
    await this.getItem(track, 'track');
  }

  async getTrackAudioAnalysis(track) {
    await this.refreshAccessToken();

    const trackObject = await this.getTrack(track);

    const { body } = await this.request(`https://api.spotify.com/v1/audio-analysis/${trackObject.id}`, {
      headers: this.headers.user,
      json: true,
    });

    const parsed = this.toCamelCase(body);

    const { error } = parsed;

    if (error) throw new Error(error.message);

    return parsed;
  }

  async getArtist(artist) {
    await this.getItem(artist, 'artist');
  }

  async getAlbum(album) {
    await this.getItem(album, 'album');
  }

  async getPlaylist(playlist) {
    await this.getItem(playlist, 'playlist');
  }

  async createPlaylist({
    name, isPublic = true, description = null, isCollaborative = false,
  }) {
    await this.refreshAccessToken();

    const { id } = await this.getUserData();

    const { body } = await this.request(`https://api.spotify.com/v1/users/${id}/playlists`, {
      method: 'POST',
      headers: this.headers.user,
      json: {
        name,
        public: isPublic,
        collaborative: isCollaborative,
        description,
      },
    });

    const parsed = this.toCamelCase(body);

    const { error } = parsed;

    if (error) throw new Error(error.message);

    return parsed;
  }

  async listPlaylists(page = 1, limit = 20) {
    await this.refreshAccessToken();

    const { body } = await this.request(`https://api.spotify.com/v1/me/playlists?offset=${(page - 1) * limit}&limit=${limit}`, {
      headers: this.headers.user,
      json: true,
    });

    const parsed = this.toCamelCase(body);

    const { error, items, next } = parsed;

    if (error) throw new Error(error);

    const getPage = (pageNumber) => this.listPlaylists(pageNumber, limit);

    const getNextPage = () => {
      if (!next) return null;

      return this.listPlaylists(page + 1, limit);
    };

    if (!items.length) return null;

    return {
      items,
      getNextPage,
      getPage,
    };
  }

  startPlaybackStateChangeListener() {
    this.playbackStateChangeListener = setInterval(async () => {
      await this.refreshAccessToken();

      const playbackData = await this.getCurrentTrack();

      if (!playbackData) return;

      if (!playbackData.item) {
        if (this.currentTrack) this.lastTrack = this.currentTrack;

        this.currentTrack = null;

        return;
      }

      if (!this.currentTrack) {
        this.currentTrack = playbackData;

        this.emit('newTrack', this.currentTrack);
      }

      if (playbackData.item.name !== this.currentTrack.item.name) {
        this.lastTrack = this.currentTrack;
        this.currentTrack = playbackData;

        if (this.lastTrack.progressMs <= this.lastTrack.item.durationMs - 5000) this.emit('trackSkipped', this.lastTrack);

        this.emit('newTrack', this.currentTrack);
      }

      if (playbackData.item.name === this.currentTrack.item.name) this.currentTrack = playbackData;
    }, 1000);
  }
}
