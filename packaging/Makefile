# Get version from the version.py file
VERSION = 0.1

RPM_PKG=ncdu-output-viewer-$(VERSION)-1.fc40.x86_64.rpm
RPM=../dist/$(RPM_PKG)
binary=../target/release/ncdu-output-viewer
SRC_TS_FILES = $(wildcard ../ts/*.ts)
template_project = ../template_project

FORCE: 
../dist:
	mkdir -p ../dist

$(binary): FORCE
	cd ..
	cargo build -r

$(RPM) : $(binary) $(SRC_TS_FILES) ../dist $(template_project)
	sed -i 's/Version:.*/Version: $(VERSION)/g' rpmbuild/SPECS/ncdu-output-viewer.spec
	mkdir -p rpmbuild/SOURCES;
	cd rpmbuild/SOURCES; mkdir -p ncdu-output-viewer-$(VERSION); cd ncdu-output-viewer-$(VERSION); cp ../../../$(binary) .; cp -r ../../../$(template_project) .; mkdir -p template_project/ts; cp ../../../$(SRC_TS_FILES) template_project/ts; cd ..; tar -czvf ncdu-output-viewer-$(VERSION).tar.gz ncdu-output-viewer-$(VERSION); rm -rf ncdu-output-viewer-$(VERSION)
	cd rpmbuild; rpmbuild --define "_topdir `pwd`" -ba SPECS/ncdu-output-viewer.spec
	cp rpmbuild/RPMS/x86_64/ncdu-output-viewer-* ../dist/

rpm : $(RPM)

clean-rpm: 
	rm -rf ../packaging/rpmbuild/BUILD 
	rm -rf ../packaging/rpmbuild/BUILDROOT
	rm -rf ../packaging/rpmbuild/RPMS 
	rm -rf ../packaging/rpmbuild/SRPMS
	rm -rf ../packaging/rpmbuild/SOURCES

dist: rpm

clean: clean-rpm
	rm -rf ../dist
