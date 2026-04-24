# OJS 3.4 — Fly-hosted companion to sof.ai's Journalism School of AI.
#
# Extends the official PKP image (https://hub.docker.com/r/pkpofficial/ojs).
# Two things we overlay:
#   1. postgresql-client — the upstream image ships MySQL by default, we run
#      on Fly Postgres.
#   2. A replacement ``ojs-cli-install`` that:
#        * supports the ``postgres9`` driver (upstream script hard-codes
#          ``mysqli``), and
#        * reads admin credentials from env (upstream hard-codes admin/admin,
#          which is unacceptable for a public instance).
#   3. A replacement ``ojs-start`` that runs the install POST *after* Apache
#      has started accepting connections (upstream calls the install script
#      in ``ojs-pre-start``, before Apache is up — the install POST hits a
#      dead port and silently fails). We keep upstream's pre-start for cert
#      + config-file substitution, just strip its embedded install trigger.
#
# pkpofficial/ojs is Alpine-based, so we use apk (not apt-get).

FROM pkpofficial/ojs:3_4_0-5

USER root
# pkpofficial/ojs:3_4_0-5 ships only MySQL PHP extensions; we add php81-pgsql
# so OJS accepts the ``postgres9`` driver in its install form. Without this,
# ``InstallForm::getDatabaseDriversOptions()`` silently strips postgres from
# the driver allowlist and any install POST specifying it fails validation.
# php81-pgsql gives us the pgsql extension (used by ADOdb), php81-pdo_pgsql
# gives us the PDO driver (used by OJS 3.4's Illuminate-based migration
# layer — without it, ``create table`` SQL fails with "could not find driver").
RUN apk add --no-cache postgresql-client curl php81-pgsql php81-pdo_pgsql

COPY ojs-cli-install /usr/local/bin/ojs-cli-install
COPY ojs-start /usr/local/bin/ojs-start
RUN chmod +x /usr/local/bin/ojs-cli-install /usr/local/bin/ojs-start

EXPOSE 80 443

# Inherit CMD = ["ojs-start"] from the base image.
