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
exports.compress = function(json) { // {{{1
    var result = [];
    var pos = 4;

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
    function writeType(json, length) { //{{{2
        if(length === 'compressed') {
            writeCode(6+json*8);
        } else if(json === true) {
            writeCode(8);
        } else if(json === false) {
            writeCode(16);
        } else if(json === undefined) {
            writeCode(24);
        } else if(typeof json === 'string') {
            writeCode(1 + length * 8);
        } else if(typeof json === 'number') {
            // integer
            if((json|0) === json) {
                writeCode(Math.abs(json*16) | 2 | (json<0?8:0));
            } else {
                writeCode(3 + length * 8);
            }
        } else if(Array.isArray(json)) {
            writeCode(4 + 8 * length);
        } else if(typeof json === 'object') {
            writeCode(5 + 8 * length);
        } else {
            throw {error: 'not json', data: json};
        }
    }
    function writeString(str) { //{{{2
        // TODO: add compression...
        for(var i = 0; i < str.length; ++i) {
            var c = str.charCodeAt(i);
            while(c > 127) {
                writeByte((c&127)|128);
                c <<= 7;
            }
            writeByte(c);
        }
    }
    function writeArrayData(array) { //{{{2
        lengths = [];
        for(i=0;i<json.length;++i) {
            lengths.push(writeData(json[i]));
        }
        for(i=json.length-1;i>=0;--i) {
            writeType(json[i], lengths[i]);
        }
    }

    function writeData(json) { //{{{2
        // TODO: add compression if this json has already been written
        var prevpos = pos;
        var lengths, i;
        if(typeof json === 'string') {
            writeString(json);
        } else if(typeof json === 'number') {
            if((json|0) === json) {
                return 0;
            } else {
                writeString(json.toString());
            }
        } else if(Array.isArray(json)) {
            writeArrayData(array);
        } else if(typeof json === 'object') {
            var array = [];
            Object.keys(json).forEach(function(key) {
                array.push(key);
                array.push(json[key]);
            });
            writeArrayData(array);
        }
        return pos - prevpos;
    }
    // Actual code {{{2 

    writeType(json, writeData(json));

    result[0] = (pos >> 0) & 255;
    result[1] = (pos >> 8) & 255;
    result[2] = (pos >> 16) & 255;
    result[3] = (pos >> 24) & 255;
    return result;
}
exports.decompress = function(buf) { // {{{1
    var right = 0;
    var left = 4;
    right |= buf[0];
    right |= buf[1]<<8;
    right |= buf[2]<<16;
    right |= buf[3]<<24;

    function readRightByte() { //{{{2
        return buf[--right];
    }
    function readCode() { //{{{2
        var b, result = 0;
        do {
            b = readRightByte();
            result = (result << 7) | (b&127);
        } while(b & 128);
        return result;
    }

    function decompressString(length) {
        throw 'TODO'
    }
    function decompress() {
        var code = readCode();
        var length = code >> 3;
        var type = code & 7;
        if(code === 8) { return true; }
        if(code === 16) { return false; }
        if(code === 24) { return undefined; }
        if(type === 1) { // String
            return decompressString(length);
        } else if(type === 2) { // Integer
            if(code&8) { // sign
                return -(code>>4);
            } else {
                return code>>4;
            }
        } else if(type === 3) { // Number
            return +decompressString(length);
        } else if(type === 4) { // Array
            throw 'todo';
        } else if(type === 5) { // Object
            throw 'todo';
        } else if(type === 6) { // Compressed
            throw 'todo';
        }
    }
    return decompress();
}

var compressed = exports.compress(['abc', '123', true, false, undefined, 1, 2, 3.5]);
console.log(exports.decompress(exports.compress(-10001)));
