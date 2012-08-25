(function(){
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
function compress(json) { // {{{1
    function writeByte(num) { result[pos++] = num; } //{{{2
    function writeCode(num) { //{{{2
        writeByte(num&127);
        num = (num / 128) |0;
        while(num) {
            writeByte((num&127)|128);
            num >>= 7;
        }
    }
    function writeArray(array) { //{{{2
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
    function writeString(str) { //{{{2
        var i = str.length;
        var prevEnc = undefined;
        var enc;
        while(i) {
            var i0 = i;
            --i;

            // Single char
            var c = str.charCodeAt(i);
            if(!(c&0xe0)) { c+=256; };

            // Lookup in table
            var j = i;
            var code2 = undefined;
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
    function write(json) {//{{{2
        var prevpos, t; //{{{3
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
                    writeCode(1 + (pos-strDict[json])* 8);
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
    //{{{2
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
    return result.slice(0, result.length/2).join('');
}

function CreateObject(buf, pos) { // {{{1
    pos = pos || buf.length * 2;
    function peekByte() { 
        return (buf.charCodeAt((pos-1)>>1) >> (8*((pos-1)&1))) & 255;
    }
    function readByte() { 
        --pos;
        return (buf.charCodeAt(pos>>1) >> (8*(pos&1))) & 255;
    }
    function readCode() { //{{{2
        var b, result = 0;
        do {
            b = readByte();
            result = (result << 7) | (b&127);
        } while(b & 128);
        return result;
    }
    function readStringCode(acc) {//{{{2
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
    function readString(length) {//{{{2
        var result = [];
        var endpos = pos - length;
        while(pos > endpos) {
            readStringCode(result);
        }
        return result.join('');
    }
    function readArray(length) {//{{{2
        var result = [];
        var endpos = pos - length;
        while(pos > endpos) {
            result.push(readJSON());
        }
        return result;
    };

    function readJSON() {//{{{2
        var code = readCode();
        var length = code >> 3;
        var type = code & 7;
        var result;
        if(code === 8) { return true; }
        if(code === 16) { return false; }
        if(code === 24) { return undefined; }
        if(code === 32) { return null; }
        if(type === 1) { // backref
            var prevpos = pos;
            pos -= length;
            result = readJSON();
            pos = prevpos;
            return result;
        }
        if(type === 2) { return (code&8)?-(code>>4):(code>>4); } // Integer
        if(type === 4) { return readString(length); }
        if(type === 5) { return +readString(length); } // Number
        if(type === 6) { return readArray(length); }
        if(type === 7) { // Object
            var array = readArray(length);
            var result = {};
            for(var i = 0; i < array.length; i+=2) {
                result[array[i]] = array[i+1];
            }
            return result;
        }
        throw 'unhandled type or atom';
    }
    function skip() {
        var code = readCode();
        if((code&7)>3) {
            pos -= code >> 3;
        }
    }
    function each(fn) {
        var code = readCode();
        var length = code >> 3;
        if((code&7) < 6) {
            throw 'each only possible on array and object';
        }
        var isObj = (code&7===7);
        var pos0 = pos - length;
        var i = 0;
        while(pos0 < pos) {
            if(isObj) {
                fn(readJSON(), CreateObject(buf, pos));
            } else {
                fn(i++, createObject(buf, pos));
            }
            skip();
        }
    }
    return {
        val: function() { var t = pos; result = readJSON(); pos = t; return result; },
        get: function(id) {
            var result = undefined
            this.each(function(key, val) {
                if(key === id) { result = val; }
            });
            return result;
        },
        each: each,
        isArray: function() { return (peekByte()&7) === 6; },
        isObject: function() { return (peekByte()&7) === 7; },
    };
}
// Export - both for commonjs and browser {{{1
var cj;
if(typeof exports === 'object') {
    cj = exports;
} else if(typeof window !== 'undefined') {
    window.cj = cj = {};
}

cj.encode = compress;
cj.CreateObject = CreateObject;

var data;
data = {a: 1, b:2, c: 3};
data = JSON.parse(require('fs').readFileSync('test/sample.json', 'utf8'));
require('assert').deepEqual(data, cj.CreateObject(cj.encode(data)).val());
var compressed = cj.encode(data);
console.log('json:', JSON.stringify(data).length);
console.log('  cj:', JSON.stringify(compressed).length);
CreateObject(compressed).get('meta').each(function(key, val) {
    console.log(key);
});


})();
