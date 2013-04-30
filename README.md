# ![logo](https://solsort.com/_logo.png) CJ - Compressed JSON

The compact way to store JavaScript objects.

- Duplicate values are only store once.
- Compression of strings
- Efficient coding of integers
- Possible to access / navigate through the object without decompressing it.
- Only supports JSON-objects, ie. non-cyclic structures of Arrays/Objects/Booleans/Strings/Numbers/undefined
- Works both client-side and server-side (node.js, etc.)

## Results

- A sample 35kb JSON-file (https://api.github.com/users/mozilla/repos) got compressed to approx. 15% of its size.

## API

- `compressed = cj(obj)` returns a compressed object
- Compresed object:
    - `compressed.data` a compressed string representation of the object. Can be serialised, and a new compressed object can be created from it.
    - `compressed.val()` uncompress the object.
    - `compressed.get(key)` returns a compresse object, ie.
        - `cj({a:1, b:[2,3]).get('b').get(0).val()` returns 2
    - `compressed.each(function(key, compressedVal) {` ... `})` maps the function across all members of the compressed object. `compressedVal.val()` is needed to uncompress the value.
- `cj.fromBin(data)` returns a compressed object, from the compressed data string.


## Technical details

- Everything is encoded with Variable Byte Coding
- 3-bit tag, determining type (atom/integer/array/...)
- String compression inspired by LZ77 and binary grammar compression. 
    - compressed codes are eithter a character code or a reference to two neigbour codes in preceeding _compressed_ data.
- Performance: O(n)
- Compressed-length is encoded with variable-length objects, to make it navigational (skippable when traversing the compressed data).

- Space usage
    - true, false, undefined: 1 byte
    - 32bit integers: 1-5 bytes depending on value
    - objects and arrays: typically 1-3 bytes + size of its elements
    - strings and long/fractional-numbers: depends on context as compression is enabled
    - duplicate values: typically 1-3 bytes, independent of length
