# Get version from the version.py file
VERSION = 0.1

binary=../target/x86_64-unknown-linux-gnu/release/ncdu-output-viewer
SRC_TS_FILES = $(wildcard ../ts/*.ts)
template_project = ../template_project

RPM_PKG=ncdu-output-viewer-$(VERSION)-1.fc40.x86_64.rpm
RPM=../dist/$(RPM_PKG)

DEB_PKG=ncdu-output-viewer_$(VERSION)-1_all
DEB=../dist/$(DEB_PKG).deb

FORCE: 
../dist:
	mkdir -p ../dist

$(binary): FORCE
	cd ..
	cargo build --target x86_64-unknown-linux-gnu

$(RPM) : $(binary) $(SRC_TS_FILES) ../dist $(template_project)
	sed -i 's/Version:.*/Version: $(VERSION)/g' rpmbuild/SPECS/ncdu-output-viewer.spec
	mkdir -p rpmbuild/SOURCES;
	cd rpmbuild/SOURCES; mkdir -p ncdu-output-viewer-$(VERSION); cd ncdu-output-viewer-$(VERSION); cp ../../../$(binary) .; cp ../../../../target/x86_64-unknown-linux-gnu/release/build/ncdu-output-viewer-fa20615f29cd5b21/out/_ncdu-output-viewer .; cp ../../../../target/x86_64-unknown-linux-gnu/release/build/ncdu-output-viewer-fa20615f29cd5b21/out/ncdu-output-viewer.bash .; cp -r ../../../$(template_project) .; mkdir -p template_project/ts; cp ../../../../ts/*.ts template_project/ts; cd ..; tar -czvf ncdu-output-viewer-$(VERSION).tar.gz ncdu-output-viewer-$(VERSION); rm -rf ncdu-output-viewer-$(VERSION)
	cd rpmbuild; rpmbuild --define "_topdir `pwd`" -ba SPECS/ncdu-output-viewer.spec
	cp rpmbuild/RPMS/x86_64/ncdu-output-viewer-* ../dist/

$(DEB) : $(binary) $(SRC_TS_FILES) ../dist $(template_project)
	sed -i 's/Version:.*/Version: $(VERSION)/g' debbuild/DEBIAN/control
	mkdir -p debbuild/$(DEB_PKG)
	mkdir -p debbuild/usr/bin
	mkdir -p debbuild/usr/local/ncdu-output-viewer
	mkdir -p debbuild/usr/share/bash-completions/completions
	mkdir -p debbuild/usr/share/zsh/functions/Completion
	mkdir -p debbuild/usr/share/zsh/site-functions
	cp $(binary) debbuild/usr/bin
	cp -r $(template_project) debbuild/usr/local/ncdu-output-viewer
	cp ../target/x86_64-unknown-linux-gnu/release/build/ncdu-output-viewer-fa20615f29cd5b21/out/ncdu-output-viewer.bash debbuild/usr/share/bash-completions/completions
	cp ../target/x86_64-unknown-linux-gnu/release/build/ncdu-output-viewer-fa20615f29cd5b21/out/_ncdu-output-viewer debbuild/usr/share/zsh/functions/Completion
	cp ../target/x86_64-unknown-linux-gnu/release/build/ncdu-output-viewer-fa20615f29cd5b21/out/_ncdu-output-viewer debbuild/usr/share/zsh/site-functions
	cp -r ../packaging/debbuild/DEBIAN  ../packaging/debbuild/$(DEB_PKG)
	cp -r ../packaging/debbuild/usr ../packaging/debbuild/$(DEB_PKG)
	dpkg-deb --build --root-owner-group ../packaging/debbuild/$(DEB_PKG)
	cp ../packaging/debbuild/*.deb ../dist/

rpm: $(RPM)

deb: $(DEB)

clean-rpm: 
	rm -rf rpmbuild/BUILD 
	rm -rf rpmbuild/BUILDROOT
	rm -rf rpmbuild/RPMS 
	rm -rf rpmbuild/SRPMS
	rm -rf rpmbuild/SOURCES

clean-deb:
	rm -rf debbuild/$(DEB_PKG)
	rm -rf debbuild/$(DEB_PKG).deb
	rm -rf debbuild/usr

dist: rpm deb

clean: clean-rpm clean-deb
	rm -rf ../dist
