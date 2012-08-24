# Compressed JSON

Structure preserving compression of JSON data.

- Data consist of total byte-length as a 32bit integer, followed by value-data followed by value-type.
- Value-type is a reverse variable-byte-coded integer, where the low 3 bits is a type tag
    - Array-type, 
