'use strict';

// const BluePromise = require('bluebird');
const images = require('./images');

module.exports = {
  getRootItems,
  getQueueItems,
};

const NUMBER_OF_QUEUE_ENTRIES = 10000;

// Selected folders at root level, all directories accessible via Root folder
var MEDIA_ROOT_ITEMS = [
  {
    title: 'Favorite Radio Stations',
    thumbnailUri: images.folderIcon,
    browseIdentifier: '0/RadioTime/Favorites/MyFavorites',
  },
  {
    title: 'Playlists',
    thumbnailUri: images.folderIcon,
    browseIdentifier: '0/Playlists',
  },
  {
    title: 'Tune In',
    thumbnailUri: images.folderIcon,
    browseIdentifier: '0/RadioTime',
  },
  {
    title: 'Albums',
    thumbnailUri: images.folderIcon,
    browseIdentifier: '0/My Music/Albums',
  },
  {
    title: 'Root',
    thumbnailUri: images.folderIcon,
    browseIdentifier: '0',
  },
];


function getRootItems() {
  return MEDIA_ROOT_ITEMS;
}
  
// queue use not implemented
function getQueueItems() {
  const entryPrefix = 'Queue Item ';
  return new Array(NUMBER_OF_QUEUE_ENTRIES).fill(1)
    .map((unused, index) => {
      const title = entryPrefix + (index + 1);
      return {
        title,
        thumbnailUri: images.fileIcon,
        // in a real application the identifier might be set to a unique identifier
        actionIdentifier: title,
      };
    });
}
