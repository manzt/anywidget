---
title: 'anywidget: reusable widgets for interactive analysis and visualization in computational notebooks'
tags:
  - Computational notebooks
  - Jupyter
  - Python
  - R
  - JavaScript
  - Data visualization
  - Interactive computing
authors:
  - name: Trevor Manz
    email: trevor.j.manz@gmail.com
    orcid: 0000-0001-7694-5164
    affiliation: 1
    corresponding: true
  - name: Nezar Abdennur
    email: nezar.abdennur@umassmed.edu
    orcid: 0000-0001-5814-0864
    affiliation: "2, 3"
  - name: Nils Gehlenborg
    email: nils@hms.harvard.edu
    orcid: 0000-0003-0327-8297
    affiliation: 1
affiliations:
  - name: Department of Biomedical Informatics, Harvard Medical School, Boston, MA, USA
    index: 1
  - name: Department of Genomics and Computational Biology, UMass Chan Medical School, Worcester, MA, USA
    index: 2
  - name: Department of Systems Biology, UMass Chan Medical School, Worcester, MA, USA
    index: 3
date: 05 June 2023
bibliography: paper.bib
exports:
  - format: typst
  - template: lapreprint-typst
---

# Summary

The **anywidget** project provides a specification and toolset for portable and
reusable web-based widgets in interactive computing environments
(\autoref{fig:overview}). First, it defines a standard for widget front-end
code based on the web browser's native module system. Second, it provides tools
to author, distribute, and execute these modules across web-based computing
platforms. Since its release a year and a half ago, anywidget has steadily
gained adoption. Nearly 70 new widgets have been created or ported to anywidget
and published to the Python Package Index (PyPI), along with many standalone
scripts and notebooks. These tools cover general-purpose visualization
libraries [@jscatter; @Heer2024] as well as notebook integrations for
applications in biology [@gos; @vitessce; @viv; @cev], mapping [@lonboard],
astronomy [@ipyaladin], and education [@drawdata]. Anywidget has also been
integrated into popular visualization libraries like Altair [@altair],
enhancing interactivity in notebooks and deepening user engagement with
visualizations and code.

![The anywidget project. The Anywidget Front-End Module (AFM) is a specification for widget front-end code based on ECMAScript (ES) modules [@ecma]. AFM can be written in web-standard ES or with _authoring tools_ that support popular front-end frameworks. The `anywidget` Python package adapts Jupyter-compatible platforms (JCPs) into AFM-compatible _host platforms_, enabling Jupyter Widgets to be authored and distributed with AFM. Other _host platforms_ support AFM directly. The _project CLI_ can be used to bootstrap new anywidget projects that are ready to publish to PyPI. \label{fig:overview}](overview.png)

# Statement of need

Computational notebooks are the preferred environment for interactive computing
and data analysis. Their popularity has spurred the development of interactive
visual analytics systems that integrate seamlessly within these environments
[@Wang2024]. The Jupyter project [@Kluyver2016; @Perez2007; @Granger2021] has
fostered an ecosystem for writing, executing, and sharing computational
notebooks, including tools for converting them into formats like
books [@JupyterBook; @JupyterBookMyst], presentation slides [@nbconvert;
@Wang2023], and dashboards [@voila]. However, approaches for authoring
interactive notebook visualizations vary widely in features and platform
compatibility [@Wang2024], resulting in diverse yet incompatible systems.
This inconsistency hinders composition and reuse of interactive visualizations
in notebooks, fostering platform-specific, monolithic integrations instead of
reusable, modular components that fit various analysis workflows.

No authoring approach aligns interactive visualization systems with the broader
notebook ecosystem, except for Jupyter Widgets, which show potential due to
their modularity, wide platform support, and advanced features. However,
the complexity and error-prone nature of authoring custom Jupyter Widgets have
limited their adoption by the visualization community, leading authors to
create or resort to alternative methods. A universal protocol is needed to
simplify authorship and support a distributed collection of pluggable
interactive visualizations across computational notebooks.

# Overview

## A standard for widget front-end modules

The **Anywidget Front-End Module (AFM)** is a specification for widget
front-end code based on ECMAScript (ES) modules, the built-in module system for
web browsers.

```js
export default {
  initialize({ model }) {
    // Add instance-specific event listeners
    return () => {
      // Clean up event listeners
    }
  },
  render({ model, el }) {
    // Render the widget
    return () => {
      // Clean up event listeners
    }
  },
};
```

Widget behavior is defined through methods for managing a widget’s lifecycle,
such as initialization, rendering, and destruction. Running AFM requires a _host
platform_ to load the module and call each of these lifecycle methods with a set
of required interfaces. These interfaces include minimal APIs for the AFM to
communicate with the host and modify the output user interface (UI).

Importantly, AFM does not impose specific implementations for widget state or
UI management. By making host requirements explicit, it decouples widget
front-end code from host implementations, thereby improving widget portability
[@scipy]. With AFM, developers can author a widget writing a web-standard ES
module, either inline or in a separate file, without a build process
(\autoref{fig:afm-and-anywidget}a, top). For better ergonomics when creating
UIs, developers can introduce a build step targeting AFM to utilize advanced
tools (\autoref{fig:afm-and-anywidget}a, bottom).

![Authoring a custom Jupyter Widget with anywidget. (a) AFM can be authored in web-standard ECMAScript (top) or with a front-end framework using a bridge (bottom). (b) The anywidget Python package allows authoring custom Jupyter Widgets with AFM (top), usable across various JCPs (bottom). \label{fig:afm-and-anywidget}](afm-and-anywidget.png)

While AFM is understood by the browser directly, much of web development today
uses front-end frameworks, such as React or Svelte, which introduce
non-standard syntax and unique paradigms for UI and state management. Rather
than incorporate such frameworks into the AFM specification, the anywidget
project provides several _framework bridges_ to make it easier to author AFMs
using frameworks (\autoref{fig:afm-and-anywidget}a, bottom). These libraries
provide utilities to use idiomatic APIs and constructs to manage widget state
and to wrap those constructs into the AFM lifecycle methods used by host
platforms. For example, anywidget’s React bridge exposes a React-based
declarative hook `useModelState` for accessing widget state and a function that
converts a React component into an AFM `render` method for export.

There are several advantages to supporting frameworks via bridges. First, AFM
is more stable and minimal because it is not tied to a third-party library or
framework. Second, it gives framework communities the opportunity to build
integrations, distributing the maintenance burden and benefiting from
framework-specific expertise. This plugin-based approach has seen success in
projects like the local front-end development server Vite and the Python Flask
web framework. Third, bridges can be updated and versioned independently from
the AFM specification, meaning that changes cannot break host compatibility.

## Supporting tools and ecosystem

### Custom Jupyter Widgets

The main library for the project is `anywidget`, a Python package that
simplifies the authoring and distribution of custom Jupyter Widgets using AFM
(\autoref{fig:afm-and-anywidget}b, top). Jupyter Widgets [@ipywidgets] are the
official framework from Jupyter to extend notebooks with interactive views and
controls for objects that reside in the kernel. Since widgets are integral to
Jupyter's architecture, they enjoy broad support across Jupyter-compatible
platforms (JCPs) such as JupyterLab, Google Colab, and Visual Studio Code.
However, developing and distributing cross-JCP widgets is complex and
error-prone [@scipy]. Anywidget addresses this complexity by providing the glue
code to turn each JCP into an AFM-compatible host. This compatibility layer
aligns AFM with Jupyter Widgets and the Python ecosystem, making anywidget a
powerful tool for creating and distributing interactive widgets across
platforms. Anywidgets can be remixed and reused with other custom Jupyter
Widgets in notebooks, standalone HTML pages, and dashboarding frameworks
(\autoref{fig:afm-and-anywidget}b, bottom).

### Tooling for authorship and distribution

To make widget development more enjoyable and accessible, the anywidget project
offers additional development tools for widget authors. It allows for creating
widgets directly within notebooks, enabling them to start as prototypes and
evolve into full packages. To align with modern front-end tools, anywidget also
implements hot module replacement (HMR) for live code editing development. HMR
dynamically updates widgets without reloading the page or losing state,
improving the developer experience and enabling rapid prototyping. To enable
HMR, developers can set an environment variable in the notebook cell:

```python
%%env
ANYWIDGET_HMR=1
```

Finally, the anywidget project includes a command line interface (CLI) for
bootstrapping new anywidget projects that are ready to publish to PyPI
(\autoref{fig:overview}, bottom). The CLI includes options for selecting
front-end framework adapters and additional tools like TypeScript.

```bash
npm create anywidget@latest
```

### Beyond Jupyter

AFM extends the widget ecosystem beyond Jupyter. Many popular web frameworks
and dashboarding libraries support embedding Jupyter Widgets into their layout
systems and interacting with their components. This support also extends to
anywidgets, thanks to the Jupyter Widgets compatibility layer. AFM also
provides opportunities for frameworks and platforms to add more specialized
support, making better use of their respective internal state management and
reactivity systems. For instance, marimo [@marimo], a new reactive notebook for
Python, has adopted AFM as the standard for its third-party plugin API.
Similarly, the developers of the Panel web framework [@panel] are exploring
deeper integration with AFM for better compatibility with their reactive
programming model.

Efforts are underway to support AFM with other compute backends besides Python.
For example, anyhtmlwidget [@anyhtmlwidget] brings anywidget concepts to R,
enabling reusable AFM-based widgets for R documents and Shiny applications with
bi-directional R-JavaScript communication. Additionally, the anywidget project
implements AFM-based displays for the Deno kernel, a JavaScript and TypeScript
runtime.

# Availability

The anywidget project is released under an open-source MIT license, with all
source code publicly available on GitHub (https://github.com/manzt/anywidget).
The core Python library, anywidget, is packaged and distributed via the PyPI
and conda-forge. The front-end adapter libraries, development tooling, and
project-template CLI are distributed through the npm registry. The Deno Jupyter
kernel integration is published to the JavaScript Registry (JSR). Further
documentation about the project can be found at https://anywidget.dev.

# Related work

Interactive notebook visualization tools vary widely in features and
compatibility [@Wang2024]. Some tools offer rich features (e.g.,
bi-directional communication) but rely on platform-specific APIs, limiting
compatibility [@Zhao2022; @Wang2023; @Drosos2020; @Li2023; @Jain2022]. More
simple approaches provide broader compatibility but lack features which
meaningfully enrich user workflows. For example, using static templates or the
NOVA framework [@Wang2022] offers wide compatibility, as the resulting HTML
displays can be embedded in nearly any web-based notebook platform. However,
this approach supports only client-side applications with one-way
communication, meaning that only the initial visualization state can come from
the notebook, without further updates from other cells. Other approaches, like
ImJoy [@Ouyang2019], offer a more unified architecture for building interactive
visualizations with rich features across multiple platforms. However, it is an
entirely separate computing platform with limited JCP integrations, not a
framework for building reusable, modular visualization components.

# Acknowledgements

We thank Talley Lambert for his technical contributions to the anywidget Python
codebase and recognize Jan-Hendrik Müller for his significant community
contributions and advocacy of the project. Our appreciation extends to the
entire anywidget community and the Abdennur and HIDIVE labs for their helpful
discussions.

# References
