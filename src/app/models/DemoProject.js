"use strict";

var IDBAdapter = require('../store/StorageAdapter.js'),
    utils = require('../utils.js'),
    settings = require('../settings.js'),
    STORES = settings.STORES;

var MVS_PATH = '/mvs/option.txt.pset.json',
    BUNDLER_PATH = '/bundler/bundler.json';


module.exports = Ember.Object.extend({

    downloaded: false,

    adapter: null,

    finishedImages: false,
    finishedSIFT: false,
    finishedBundler: false,
    finishedMVS: false,


    promiseLoad: function(){
        Ember.Logger.debug('project storage adapter created');
        var adapter = new IDBAdapter(this.get('name'));
        this.set('adapter', adapter);
        this.promiseResume().then(this.promiseDownload.bind(this));
    },

    promiseResume: function(){
        var _self = this;
        var adapter = new IDBAdapter(this.get('name'));
        this.set('adapter', adapter);
        var mvsResumed = adapter
            .promiseData(STORES.SINGLETONS, STORES.MVS)
            .then(function(){
                _self.set('finishedMVS', true);
            });
        var bundlerResumed = adapter
            .promiseData(STORES.SINGLETONS, STORES.BUNDLER)
            .then(function(){
                _self.set('finishedBundler', true);
            });
        return Promise.all([
            bundlerResumed,
            mvsResumed
        ]);
    },


    promiseDownload: function(){
        if (this.get('downloaded')) {
            return Promise.resolve();
        }
        else {
            return this.promiseResume()
                .then(this.promiseDownloadImages.bind(this))
                .then(this.promiseDownloadSIFT.bind(this))
                .then(this.promiseDownloadBundler.bind(this))
                .then(this.promiseDownloadMVS.bind(this));
        }
    },


    promiseDownloadImages: function(){
        if (this.get('finishedImages')) {
            return Promise.resolve();
        }
        return Promise.all(this.get('images').map(this.promiseProcessOneImage.bind(this)));
    },


    promiseDownloadSIFT: function(){

        var adapter = this.get('adapter'),
            root = this.get('root'),
            _self = this;

        if (this.get('hasSIFT') && this.get('finishedSIFT')) {
            return Promise.resolve();
        }
        else {
            return adapter.promiseAll(STORES.IMAGES)
                .then(function(images){
                    return Promise.all(images.map(function(result){
                        return _self.promiseDownloadOneSIFT(result.key, result.value);
                    }));
                });
        }
    },


    promiseDownloadBundler: function(){
        if (this.get('hasBundler') && this.get('finishedBundler')) {
            return Promise.resolve();
        }
        return utils.requireJSON(this.get('root')+BUNDLER_PATH);
    },


    promiseDownloadMVS: function(){
        if (this.get('hasMVS') && this.get('finishedMVS')) {
            return Promise.resolve();
        }
        var adapter = this.get('adapter');
        var url = this.get('root')+MVS_PATH;
        return utils.requireJSON(url).then(function(data){
            return adapter.promiseSetData(STORES.SINGLETONS, STORES.MVS, data);
        });
    },


    /**
     *
     * @param {String} _id
     * @param {IDBImage} image
     * @returns {Promise}
     */
    promiseDownloadOneSIFT: function(_id, image){
        var adapter = this.get('adapter'),
            rawName = image.filename.split('.')[0],
            siftUrl = this.get('root') + '/sift.json/' + rawName + '.json';

        return utils.requireJSON(siftUrl)
            .then(function(sift){
                return adapter.promiseSetData(STORES.FEATURES, _id, sift.features);
            });
    },


    promiseProcessOneImage: function(name){
        var imageUrl = this.get('root') + '/images/' + name,
            adapter = this.get('adapter');

        return utils.requireImageFile(imageUrl)
            .then(function(blob){
                blob.name = name;
                return adapter.processImageFile(blob);
            });
    }

});