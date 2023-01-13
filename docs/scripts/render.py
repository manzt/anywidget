#!/usr/bin/env python

import nbformat
import nbconvert
import json

import sys

if __name__ == "__main__":
    nb = nbformat.read(sys.argv[1], as_version=4)
    nb = nbconvert.preprocessors.ExecutePreprocessor().preprocess(nb)[0]
    print(json.dumps(nb))
