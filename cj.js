(function(){
    'use strict';
// Types
// 0: atom
// • 8: true
// • 16: false
// • 24: undefined
// 1: Compressed
// 2: integer
// bit 4 is sign
// 4: string
// 5: number
// 6: Array
// 7: Object
//
function cj(json) {
    function writeByte(num) { 
        result[pos++] = num; 
    }
    function writeCode(num) {
        writeByte(num&127);
        num = (num / 128) |0;
        while(num) {
            writeByte((num&127)|128);
            num >>= 7;
        }
    }
    function writeArray(array) {
        var i = array.length;
        while(i) {
            --i;
            write(array[i]);
        }
    }
    function updateDict(dict, str) {
        if(str) {
            var next = dict[str[0]] || {};
            dict[str[0]] = next;
            updateDict(next, str.slice(1));
        } else {
            dict.pos = pos;
        }
    }
    function writeString(str) {
        var i = str.length;
        var prevEnc;
        var enc;
        while(i) {
            var i0 = i;
            --i;

            // Single char
            var c = str.charCodeAt(i);
            if(!(c&0xe0)) { c+=256; }

            // Lookup in table
            var j = i;
            var code2;
            var dict = tree;
            while(j && dict[str[j]]) {
                dict = dict[str[j]];
                if(dict.pos) {
                    code2 = pos - dict.pos;
                    c = code2 & 31;
                    code2 = code2 >> 5;
                    i = j;
                }
                --j;
            }

            // Write the code
            if(c < 32) {
                writeCode(code2);
            }
            writeCode(c);

            // Update compression dictionary
            enc = str.slice(i, i0).split('').reverse().join('');
            if(prevEnc !== undefined) {
                updateDict(tree, prevEnc+enc);
            }
            prevEnc = enc;
        }
    }
    function write(json) {
        var prevpos, t;
        if(json === true) {
            writeCode(8);
        } else if(json === false) {
            writeCode(16);
        } else if(json === undefined) {
            writeCode(24);
        } else if(json === null) {
            writeCode(32);
        } else if(typeof json === 'string') {
            if(strDict[json]) {
                writeCode(1 + (pos-strDict[json])* 8);
            } else {
                prevpos = pos;
                writeString(json);
                writeCode(4 + (pos-prevpos)* 8);
                strDict[json] = pos;
            }
        } else if(typeof json === 'number') {
            // integer
            if((json|0) === json) {
                writeCode(Math.abs(json*16) | 2 | (json<0?8:0));
            } else {
                if(numDict[json]) {
                    writeCode(1 + (pos-numDict[json])* 8);
                } else {
                    prevpos = pos;
                    writeString(json.toString());
                    writeCode(5 + (pos-prevpos)* 8);
                    numDict[json] = pos;
                }
            }
        } else if(Array.isArray(json)) {
            prevpos = pos;
            writeArray(json);
            writeCode(6 + (pos-prevpos)* 8);
        } else if(typeof json === 'object') {
            prevpos = pos;
            var array = [];
            Object.keys(json).forEach(function(key) {
                array.push(key);
                array.push(json[key]);
            });
            writeArray(array);
            writeCode(7 + (pos-prevpos)* 8);
        } else {
            throw {error: 'not json', data: json};
        }
    }
    var result = [];
    var strDict = {}, numDict = {};
    var tree = {};
    var pos = 0;
    write(json);
    if(result.length & 1) {
        result.unshift(0);
    }
    for(var i = 0; i < result.length; i+=2) {
        result[i/2] = String.fromCharCode(result[i] + 256 * result[i+1]);
    }
    return createObject(result.slice(0, result.length/2).join(''));
}
var proto;
function createObject(buf, pos) {
    var result = Object.create(proto);
    result.data = buf;
    result.pos = pos;
    return result;
}

proto = (function() {
    var buf, pos;
    function readByte() { 
        --pos;
        return (buf.charCodeAt(pos>>1) >> (8*(pos&1))) & 255;
    }
    function readCode() {
        var b, result = 0;
        do {
            b = readByte();
            result = (result << 7) | (b&127);
        } while(b & 128);
        return result;
    }
    function readStringCode(acc) {
       var c = readCode();
       if(c<32) {
           c = readCode() * 32 + c;
           var prevpos = pos;
           pos -= c;
           readStringCode(acc);
           readStringCode(acc);
           pos = prevpos;
       } else {
          acc.push(String.fromCharCode((c&0xe0)?c:c-256));
       }
    }
    function readString(length) {
        var result = [];
        var endpos = pos - length;
        while(pos > endpos) {
            readStringCode(result);
        }
        return result.join('');
    }
    function readArray(length) {
        var result = [];
        var endpos = pos - length;
        while(pos > endpos) {
            result.push(readJSON());
        }
        return result;
    }

    function readJSON() {
        var code = readCode();
        var length = code >> 3;
        var type = code & 7;
        var array, result;
        if(code === 8) { 
            result = true; 
        } else if(code === 16) { 
            result = false; 
        } else if(code === 24) { 
            result = undefined; 
        } else if(code === 32) { 
            result = null; 
        } else if(type === 1) { // backref
            var prevpos = pos;
            pos -= length;
            result = readJSON();
            pos = prevpos;

        // Integer
        } else if(type === 2) { 
            result = (code&8)?-(code>>4):(code>>4); 

        } else if(type === 4) { 
            result = readString(length); 

        // Number
        } else if(type === 5) { 
            result = +readString(length); 
        } else if(type === 6) { 
            result = readArray(length); 
        // Object
        } else if(type === 7) { 
            array = readArray(length);
            result = {};
            for(var i = 0; i < array.length; i+=2) {
                result[array[i]] = array[i+1];
            }
        } else {
            throw 'unhandled type or atom: ' + type;
        }
        console.log(result);
        return result;
    }

    function skip() {
        var code = readCode();
        if((code&7)>3) {
            pos -= code >> 3;
        }
    }
    function each(fn) {
        buf = this.data;
        pos = this.pos || buf.length * 2;

        var code = readCode();
        var length = code >> 3;
        if((code&7) < 6) {
            fn(undefined, readJSON());
            return;
        }
        var isObj = (code&7===7);
        var pos0 = pos - length;
        var i = 0;
        while(pos0 < pos) {
            if(isObj) {
                fn(readJSON(), createObject(buf, pos));
            } else {
                fn(i++, createObject(buf, pos));
            }
            skip();
        }
    }
    return {
        val: function() { 
            buf = this.data;
            pos = this.pos || buf.length * 2;
            return readJSON();
        },
        get: function(id) {
            var result;
            this.each(function(key, val) {
                if(key === id) { result = val; }
            });
            return result;
        },
        each: each,
    };
})();
cj.fromBin = createObject;


// Export - both for commonjs and browser 
if(typeof exports === 'object' && typeof module === 'object') {
    module.exports = cj;
} else if(typeof window !== 'undefined') {
    window.cj = cj;
}

// test
var data;
data = {a: 1, b:2, c: 3};
data = JSON.parse(require('fs').readFileSync('test/sample.json', 'utf8'));
data = JSON.parse(require('fs').readFileSync('crime-data_geojson.json', 'utf8'));
//data = data.features.slice(157,167);
//data = [data.features[157], data.features[166]];
console.log(JSON.stringify(data));
console.log(JSON.stringify(data).length, cj(data).data.length);
require('assert').deepEqual(data, cj(data).val());
var compressed = cj(data);
console.log('json:', JSON.stringify(data).length);
console.log('  cj:', compressed.data.length);
/*
compressed.get('meta').each(function(key, val) {
    console.log(key);
});
*/

})();
