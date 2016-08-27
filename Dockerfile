FROM node:6.4.0

COPY myhubot/package.json /tmp/package.json

RUN cd /tmp && \
 npm install && \
 npm install -g pm2 && \
 mkdir /myhubot && \
 mkdir /logs && \
 mv /tmp/node_modules /myhubot && \
 echo "deb http://ftp.de.debian.org/debian sid main" >> /etc/apt/sources.list && \
 apt-get update && \
 apt-get install -y \
 libunwind8 \
 libicu55 && \
 apt-get install -fy && \
 curl -LO https://github.com/PowerShell/PowerShell/releases/download/v6.0.0-alpha.9/powershell_6.0.0-alpha.9-1ubuntu1.16.04.1_amd64.deb && \
 dpkg -i powershell_6.0.0-alpha.9-1ubuntu1.16.04.1_amd64.deb


COPY myhubot /myhubot

ENV HUBOT_ADAPTER="slack" \
    HUBOT_LOG_LEVEL="debug"

WORKDIR /myhubot

CMD [ "pm2", "start", "processes.json", "--no-daemon" ]
