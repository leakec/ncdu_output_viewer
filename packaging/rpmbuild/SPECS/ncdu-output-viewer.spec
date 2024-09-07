Name: ncdu-output-viewer
Version: 0.1
Release:        1%{?dist}
Summary: Open connnect GUI

License:        MIT
URL:           https://dartsgitlab-internal.jpl.nasa.gov/leake/rust_open_connect
Source0:        ncdu-output-viewer-%{version}.tar.gz

Requires: yarnpkg, make, nodejs >= 16, postgresql-server, postgresql-contrib
BuildRoot:      %{_tmppath}/%{name}-%{version}-%{release}-root-%(%{__id_u} -n)

%description
Open connnect GUI written in rust.

%prep
%setup -q

%install
rm -rf $RPM_BUILD_ROOT
install -d $RPM_BUILD_ROOT/usr/bin
install ncdu-output-viewer $RPM_BUILD_ROOT/usr/bin/ncdu-output-viewer
install -d $RPM_BUILD_ROOT/usr/local/ncdu-output-viewer
cp -r template_project $RPM_BUILD_ROOT/usr/local/ncdu-output-viewer/template_project
install -d $RPM_BUILD_ROOT/usr/share/zsh/site-functions
install _ncdu-output-viewer $RPM_BUILD_ROOT/usr/share/zsh/site-functions/_ncdu-output-viewer
install -d $RPM_BUILD_ROOT/usr/share/bash-completions/completions
install ncdu-output-viewer.bash $RPM_BUILD_ROOT/usr/share/bash-completions/completions/ncdu-output-viewer.bash

%files
/usr/bin/ncdu-output-viewer
/usr/local/ncdu-output-viewer
/usr/share/zsh/site-functions/_ncdu-output-viewer
/usr/share/bash-completions/completions/ncdu-output-viewer.bash

%clean
rm -rf $RPM_BUILD_ROOT

%changelog
* Sat Apr 15 2024 leake test
- 
