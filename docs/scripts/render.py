#!/usr/bin/env python

import nbclient
import nbformat
import json

import sys


def main():
    nb = nbformat.read(sys.argv[1], as_version=4)
    client = nbclient.NotebookClient(nb)
    client.execute()
    print(json.dumps(nb))


if __name__ == "__main__":
    main()
