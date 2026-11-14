# US ZIP data

`us-zip-codes.json` maps a 5-digit ZIP to `[lat, lng, city, state, county]`.

- Source: GeoNames postal code export for the US — <https://download.geonames.org/export/zip/US.zip>
- License: Creative Commons Attribution 4.0 (attribution: GeoNames, <https://www.geonames.org/>)
- Built on 2026-11-13 (40,979 ZIPs). Coordinates are rounded to 3 decimals (~100 m).

To rebuild: download `US.zip`, unzip `US.txt`, and keep columns 2 (ZIP), 3 (place),
5 (state code), 6 (county), 10 (lat), 11 (lng) for rows with a 5-digit ZIP and a
2-letter state code. Write the result as one JSON object keyed by ZIP.
