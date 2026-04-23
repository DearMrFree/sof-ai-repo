# OJS 3.4 — Fly-hosted companion to sof.ai's Journalism School of AI.
#
# We extend the official PKP image (https://hub.docker.com/r/pkpofficial/ojs)
# and wire it to an external PostgreSQL database (Fly Postgres is a natural
# fit since we already run one for the sof-ai-api). Scholarly files and
# uploaded assets live on a persistent Fly volume so a machine restart does
# not wipe submissions.
#
# Build locally:
#   docker build -t sofai-ojs ojs-host
# Deploy to Fly (after `fly apps create sofai-ojs`):
#   fly deploy -c ojs-host/fly.toml

FROM pkpofficial/ojs:3_4_0-5

# The base image already installs PHP + Apache + OJS. We only overlay:
#   1. a small entrypoint that templates config.inc.php from env vars
#      (so secrets stay in Fly secrets, not in the image)
#   2. PostgreSQL client libs (the base image ships MariaDB by default).
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-client \
        gettext-base \
    && rm -rf /var/lib/apt/lists/*

COPY docker-entrypoint.sh /usr/local/bin/sofai-entrypoint.sh
RUN chmod +x /usr/local/bin/sofai-entrypoint.sh

# Re-expose the base image's standard port.
EXPOSE 80

ENTRYPOINT ["/usr/local/bin/sofai-entrypoint.sh"]
CMD ["apache2-foreground"]
