var fs = require('fs');

var data = JSON.parse(fs.readFileSync('test/sample.json', 'utf8'));
//console.log('Uncompressed length:', JSON.stringify(data).length);

// Types
// 0: atom
// • 8: true
// • 16: false
// • 24: undefined
// 1: string
// 2: integer
// bit 4 is sign
// 3: number
// 4: Array
// 5: Object
// 6: Compressed
//
function compress(json) { // {{{1
    function writeByte(num) {//{{{2
        result[pos++] = num;
    }
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
    function updateDict(dict, str, len) {
        if(str) {
            var next = dict[str[0]] || {};
            dict[str[0]] = next;
            updateDict(next, str.slice(1), len);
        } else {
            dict.pos = pos;
            dict.len = len;
        }
    }
    function codeLength(code) {
        var result = 0;
        do {
            ++result;
            code >>= 7;
        } while(code);
        return result;
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
            if(c < 32) { c+=65536; };

            // Lookup in table
            var j = i;
            var len = 0;
            var code2 = undefined;
            var dict = trie;
            while(j && dict[str[j]]) {
                dict = dict[str[j]];
                if(dict.pos) {
                    len = i - j + 1;
                    code2 = pos - dict.pos;
                    c = dict.len - 2;
                    i = j;
                }
                --j;
            }
            if(len) {
                //console.log(len, code2,  codeLength(code2>>5)); 
            }
            if(len > codeLength(code2>>5)) { 
            }

            // write
            if(c < 32) {
                writeCode(code2);
            }
            writeCode(c);

            // update table
            enc = str.slice(i, i0).split('').reverse().join('');
            if(prevEnc !== undefined) {
                updateDict(trie, prevEnc+enc, 2);
            }
            prevEnc = enc;
        }
    }
    function write(json) {//{{{2
        // TODO: add compression...
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
                writeCode(6 + (pos-strDict[json])* 8);
            } else {
                prevpos = pos;
                writeString(json);
                writeCode(1 + (pos-prevpos)* 8);
                strDict[json] = pos;
            }
        } else if(typeof json === 'number') {
            // integer
            if((json|0) === json) {
                writeCode(Math.abs(json*16) | 2 | (json<0?8:0));
            } else {
                if(numDict[json]) {
                    writeCode(6 + (pos-strDict[json])* 8);
                } else {
                    prevpos = pos;
                    writeString(json.toString());
                    writeCode(3 + (pos-prevpos)* 8);
                    numDict[json] = pos;
                }
            }
        } else if(Array.isArray(json)) {
            prevpos = pos;
            writeArray(json);
            writeCode(4 + (pos-prevpos)* 8);
        } else if(typeof json === 'object') {
            prevpos = pos;
            var array = [];
            Object.keys(json).forEach(function(key) {
                array.push(key);
                array.push(json[key]);
            });
            writeArray(array);
            writeCode(5 + (pos-prevpos)* 8);
        } else {
            throw {error: 'not json', data: json};
        }
    }
    //{{{2 
    var result = [];
    var strDict = {}, numDict = {};
    var trie = {};
    var pos = 0;
    write(json);
    return result;
}

function decompress(buf, pos) { // {{{1
    pos = pos || buf.length;
    function readByte() { //{{{2
        return buf[--pos];
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
           //c = readCode() * 32 + c;
           var code2 = readCode();
           var prevpos = pos;
           pos -= code2;
           c+=2;
           do {
               readStringCode(acc);
           } while(--c);
           pos = prevpos;
       } else {
          acc.push(String.fromCharCode(c & 65535));
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
        if(type === 1) { return readString(length); }
        if(type === 2) { return (code&8)?-(code>>4):(code>>4); } // Integer
        if(type === 3) { return +readString(length); } // Number
        if(type === 4) { return readArray(length); }
        if(type === 5) { // Object
            var array = readArray(length);
            var result = {};
            for(var i = 0; i < array.length; i+=2) {
                result[array[i]] = array[i+1];
            }
            return result;
        } 
        if(type === 6) { // backref
            return decompress(buf, pos - length);
        }
        throw 'unhandled type or atom';
    }
    return readJSON(); // {{{2
}
//{{{1
var testdata = ['ababababa bababa babab\n\t\rc', '123', {a:1, b:[1,'123',3], c:{}}, true, false, undefined, 1, 2, 3.5];
var testdata = JSON.parse(require('fs').readFileSync('test/sample.json'));
var json = JSON.stringify(testdata);
var compressed = compress(testdata);
var decompressed = JSON.stringify(decompress(compressed));
//console.log(compressed.map(function(a) { return String.fromCharCode(a); }));
//console.log([compressed.map(function(a) { return String.fromCharCode(a); }).reverse().join('')]);
if(json !== decompressed) { console.log('compression/decompression error:');
    console.log(json);
    console.log(decompressed);
} else {
    console.log('JSON length:', json.length);
    console.log('compressed length:', compressed.length);
}
