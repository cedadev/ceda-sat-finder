#####
## Docker image for CEDA Flight Finder
#####

ARG BASE_IMAGES_REGISTRY=registry.ceda.ac.uk/base-images
ARG BASE_IMAGES_VERSION

ARG GIT_REPOSITORY=https://github.com/cedadev/ceda-map-uis
# This should be set to a fixed commit of the code repository
# To rebuild with a newer version of the code, update this variable and commit
# This ensures that the build for any given commit to this build repository is repeatable
ARG GIT_VERSION=6fb8e28608a995e0926a486dbba2dd9971295e44

FROM ${BASE_IMAGES_REGISTRY}/git-checkout:${BASE_IMAGES_VERSION} as application-source
FROM ${BASE_IMAGES_REGISTRY}/centos7:${BASE_IMAGES_VERSION}
# FROM ${BASE_IMAGES_REGISTRY}/centos7:${BASE_IMAGES_VERSION}

COPY --from=application-source /application /application

## From Scratch, make dockerfile for this app

WORKDIR /application

USER 0
RUN yum install -y npm
RUN npm install -g http-server

EXPOSE 8080

CMD ["http-server","-p","8080","/application/flights-ui"]
