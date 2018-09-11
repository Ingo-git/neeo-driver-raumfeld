'use strict';

const BluePromise = require('bluebird');
const neeoapi = require('neeo-sdk');
const debug = require('debug')('neeo:player:browserService');
const directory = require('./directory/index');
const images = require('./directory/images');
const RaumController = require('./RaumController')

const ROOT_DIRECTORY = 'PLAYER_ROOT_DIRECTORY';
const QUEUE_DIRECTORY = 'PLAYER_QUEUE_DIRECTORY';

module.exports = {
  browse,
  QUEUE_DIRECTORY,
  ROOT_DIRECTORY,
};

function browse(listOptions) {
  debug('browse called with %o', listOptions);
  const params = listOptions.params;
  const browseIdentifier = params.browseIdentifier;
  
  //check if a root view should be displayed
  if (listOptions.showRoot) {
    var results = getRootListModel(listOptions);
    return results;
  }
  if (listOptions.showQueue) {
    return getQueueListModel(listOptions.params);
  }

  // browseIdentifier tells us where we are in our directory
  return RaumController.getBrowseItemsFor(browseIdentifier)
    .then((listItems) => {
      const list = buildListModel(listItems, listOptions.params);
      const title = `Browsing ${listOptions.params.browseIdentifier}`;
      list.setListTitle(title);
      return BluePromise.resolve(list);
    });
}

/**
  * returns the root list view
  */
function getRootListModel(listOptions) {
  const list = neeoapi.buildBrowseList(listOptions.params)
    .setListTitle('Raumfeld Player: ' + listOptions.deviceId )
    // .addListHeader('My RadioTime Favorites')

    /*
    .addListTiles([{
      title: 'Soundbar',
      thumbnailUri: images.soundbar,
      actionIdentifier: 'Renderer:Wohnzimmer',
    }, {
      title: 'One S',
      thumbnailUri: images.oneS,
      actionIdentifier: 'Renderer:Kueche',
    }])
    */

    .addListTiles([{
      thumbnailUri: images.rtlBerlin,
      actionIdentifier: '0/RadioTime/Favorites/MyFavorites/3',
    }, {
      thumbnailUri: images.chillout,
      actionIdentifier: '0/RadioTime/Favorites/MyFavorites/5',
    }])
    
    .addListTiles([ {
      title : 'Antenne 1',
      thumbnailUri: images.antenne1, 
      actionIdentifier: '0/RadioTime/Favorites/MyFavorites/2',
    }, {
      thumbnailUri: images.swr3,
      actionIdentifier: '0/RadioTime/Favorites/MyFavorites/7',
    }])

    .addListHeader('Browse')
    .addListItems(directory.getRootItems());

  return BluePromise.resolve(list);
}

/**
  * returns the queue list view
  */
function getQueueListModel(listOptions) {
  let listHeaderButtons = [];

  // Only show the Header Buttons on the first page
  const showListButtons = !listOptions.offset;
  if (showListButtons) {
    listHeaderButtons = [{
      title: 'Clear',
      inverse: true,
      actionIdentifier: 'QUEUE_CLEAR',
    }, {
      iconName: 'Repeat',
      actionIdentifier: 'QUEUE_REPEAT',
    }, {
      iconName: 'Shuffle',
      actionIdentifier: 'QUEUE_SHUFFLE',
    }];
  }

  const queueListItems = directory.getQueueItems();
  const list = buildListModel(queueListItems, listOptions, listHeaderButtons);
  // here the total entries of the list is updated
  list.setTotalMatchingItems(queueListItems.length)
    .setListTitle('Player Queue');
  return BluePromise.resolve(list);
}

function buildListModel(listItems, listOptions, listHeaderButtons = []) {
  const list = neeoapi.buildBrowseList(listOptions);

  if (listHeaderButtons) {
    list.addListButtons(listHeaderButtons);
  }

  return list.addListItems(listItems);
}
