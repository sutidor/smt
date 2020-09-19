#FROM yummygooey/raspbian-buster
FROM arm32v7/ubuntu:18.04
ARG DEBIAN_FRONTEND=noninteractive

WORKDIR /app

ADD . /app

# For cross compile on dockerhub
# ENV QEMU_EXECVE 1
# COPY docker/armv7/qemu-arm-static /usr/bin/
# COPY docker/armv7/resin-xbuild /usr/bin/
# RUN [ "/usr/bin/qemu-arm-static", "/bin/sh", "-c", "ln -s resin-xbuild /usr/bin/cross-build-start; ln -s resin-xbuild /usr/bin/cross-build-end; ln /bin/sh /bin/sh.real" ]
# RUN [ "cross-build-start" ]

RUN apt-get update && apt-get install -y apt-transport-https ca-certificates --assume-yes --no-install-recommends apt-utils
RUN apt-get update && apt-get install -y locales --assume-yes && rm -rf /var/lib/apt/lists/* && localedef -i en_US -c -f UTF-8 -A /usr/share/locale/locale.alias en_US.UTF-8
ENV LANG en_US.utf8

RUN apt-get update && apt-get install -y xvfb libssl-dev curl xauth --assume-yes --no-install-recommends apt-utils
RUN apt-get update && apt-get install -y build-essential --assume-yes --no-install-recommends apt-utils

# /usr/local/nvm or ~/.nvm , depending
ENV NVM_DIR /root/.nvm
ENV NODE_VERSION 12.18.3
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash \
    && . $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION

ENV NODE_PATH $NVM_DIR/versions/node/v$NODE_VERSION/lib/node_modules
ENV PATH      $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

RUN apt-get update && apt-get install -y chromium-browser --assume-yes --no-install-recommends apt-utils

# Install pm2
RUN npm config set unsafe-perm true && npm config set registry http://registry.npmjs.org/ && npm install pm2 -g

# Install project dependencies
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
RUN npm config set unsafe-perm true && npm config set registry http://registry.npmjs.org/ && npm install
RUN npm config set unsafe-perm true && npm config set registry http://registry.npmjs.org/ && npm install puppeteer@3.1.0

# For cross compile on dockerhub
# RUN [ "cross-build-end" ]

CMD ["pm2-runtime", ".pm2-process.json"]
