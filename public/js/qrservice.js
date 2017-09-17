if (typeof(qrs) === 'undefined') {	
var qrsClient = (function(container, temp){
    'use strict';
    var container = '';

    this.test = 'halo';

    this.setChatContent = function() {
    	console.log('hello from qrs');
    }
});
} else {
	console.log("QRS already defined or possessed by another value.");
}