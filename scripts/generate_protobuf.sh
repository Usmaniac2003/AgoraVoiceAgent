#!/bin/bash
# Generate JavaScript code from proto file
npx pbjs -t json-module -w es6 ./protobuf/SttMessage.proto -o ./protobuf/SttMessage_es6.js
echo "JavaScript protobuf code generation completed." 