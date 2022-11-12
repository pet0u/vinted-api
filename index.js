const fetch = require('node-fetch');
const UserAgent = require('user-agents');
const cookie = require('cookie');
const { HttpsProxyAgent } = require('https-proxy-agent');

/**
 * Fetches a new public cookie from Vinted.fr
 */
const fetchCookie = (domain = 'fr') => {
    return new Promise((resolve, reject) => {
        const controller = new AbortController();
        fetch(`https://vinted.${domain}`, {
            signal: controller.signal,
            agent: process.env.VINTED_API_HTTPS_PROXY ? new HttpsProxyAgent(process.env.VINTED_API_HTTPS_PROXY) : undefined,
            headers: {
                'user-agent': new UserAgent().toString()
            }
        }).then((res) => {
            const sessionCookie = res.headers.get('set-cookie');
            controller.abort();
            resolve(cookie.parse(sessionCookie)['secure, _vinted_fr_session']);
        }).catch(() => {
            controller.abort();
            reject();
        });
    });
}

/**
 * Parse a vinted URL to get the querystring usable in the search endpoint
 */
const parseVintedURL = (url, disableOrder, allowSwap, customParams = {}) => {
    try {
        const decodedURL = decodeURI(url);
        const matchedParams = decodedURL.match(/^https:\/\/www\.vinted\.([a-z]+)/);
        if (!matchedParams) return {
            validURL: false
        };

        const missingIDsParams = ['catalog', 'status'];
        const params = decodedURL.match(/(?:([a-z_]+)(\[\])?=([a-zA-Z 0-9._À-ú+%]*)&?)/g);
        if (typeof matchedParams[Symbol.iterator] !== 'function') return {
            validURL: false
        };
        const mappedParams = new Map();
        for (let param of params) {
            let [ _, paramName, isArray, paramValue ] = param.match(/(?:([a-z_]+)(\[\])?=([a-zA-Z 0-9._À-ú+%]*)&?)/);
            if (paramValue?.includes(' ')) paramValue = paramValue.replace(/ /g, '+');
            if (isArray) {
                if (missingIDsParams.includes(paramName)) paramName = `${paramName}_id`;
                if (mappedParams.has(`${paramName}s`)) {
                    mappedParams.set(`${paramName}s`, [ ...mappedParams.get(`${paramName}s`), paramValue ]);
                } else {
                    mappedParams.set(`${paramName}s`, [paramValue]);
                }
            } else {
                mappedParams.set(paramName, paramValue);
            }
        }
        for (let key of Object.keys(customParams)) {
            mappedParams.set(key, customParams[key]);
        }
        const finalParams = [];
        for (let [ key, value ] of mappedParams.entries()) {
            finalParams.push(typeof value === 'string' ? `${key}=${value}` : `${key}=${value.join(',')}`);
        }

        return {
            validURL: true,
            domain: matchedParams[1],
            querystring: finalParams.join('&')
        }
    } catch (e) {
        return {
            validURL: false
        }
    }
}

const cookies = new Map();

/**
 * Searches something on Vinted
 */
const search = (url, disableOrder = false, allowSwap = false, customParams = {}) => {
    return new Promise(async (resolve, reject) => {

        const { validURL, domain, querystring } = parseVintedURL(url, disableOrder ?? false, allowSwap ?? false, customParams);
        
        if (!validURL) {
            console.log(`[!] ${url} is not valid in search!`);
            return resolve([]);
        }

        const cachedCookie = cookies.get(domain);
       // const cookie = cachedCookie && cachedCookie.createdAt > Date.now() - 60_000 ? cachedCookie.cookie : await fetchCookie(domain).catch(() => {});
        const cookie_value = "eCtJMjJxV2FnZVdZT0UwOXZYTVNLaERqeVVRMkFWTlM5YnRXQlNBbW95elVCL2Rzb2R5QlhwbG5WS0NITnhuVGd4WHcvaXBDK3BpODRyL1hsQVk4cVdGR3hDYTNxMTJUTzhHMEJ1NHV5UlQyekpwWlcveEx3cFhwblNUUUgwOEk5THM3dXVJc3p1Tmd4aERqMVMxZGxGYk5GZGFxYkVwdldTbVBsaWFlOTMwSFB1UUYrSlVhOElsS0lhTmZqZlpOd1ExWElOMXBvMXYrRWhad29uNXNEU2gzYytQdWVSTktIeW1lZjdIazdQS2Q0QisrTEdkaEVDcHVBdm9FZlNKUS9YV1VLVHgzN05UWDBXdnN2MWt3cW5rL29ETzFnQlg1dHluYUJVNkNFa2wzbSt6cmJzaDdnclpRM1prMkNYRmdVTUdjSFhKU29ZdlVSckFTdWpkWU9ZK2hqbFJvZk5uS0ExT0NqTVZOZThoMjJ6ZDVUamhqTDFYQWVoUHAwQ25hL3N5VFNHL1J1aGNxR0RpNDl5MWlITlZkVnZCNE43elkxMkFBd2JnbXJzU3pqeDI5M2pZdmlsVGVPTUZwMC9GWGtHNHMxNitEMnFvQzlLcmlzWndRc1UrNERrUTNLRXJLdVRsSnVzNnpybzErdmd5b2JKTlRIQ0tCeVgyQWo3bzY5NnlybURWUzVXOVVXVnliQm10RFRtTU5tOVloNVdzd0FPTUEvZVdhT2dmMmJoS0JJTmZDZjlSaVp2c29NYkpSdWprMzdOUVBBckJOQkpjRDFrWWQwc1FpdzgrY3J0eWNVSkZ0N0xTa0Q0R1o4Q1d2T3kydWtPdTcxdG5ydEMzUktZWHdNK3gvYUlJdStQazFhZnkrME01eWk3V3BuLzVPV2VraTAydWM0MW5XTnB3S01kOXY2eGdzZy9TZXUxcVc1Q2tvQjRTdVBkZ25qY2U1a1NHeEcxVHdEc3dPOWpMUlJiRTRRTWNzeFRKOXFSd2hCYXhTTWpmeTRJc1hqNnFlUlpWR0RtY2JwcEYwL3ozQlN2SHdnUjBlNUx6eHphRHZsMFoyMnUxNkVjZEVDTTQ0NStKaVh5eTU0SXBHMDV4ZUs4MS8wRVg0a0s0SkUzL2tiUmZtWSs1dHU3cjQ1WkxzMWpwWVR0dTNxV3NMRHA5ZFRWU0FLVWFLTHR5NDFxbHFnbTRkUlU2b1VxOUZMNkdRWW5OTzZDb0c4NENsQ1o5eFp5VllwZHBLKzIyaFE1VFI4Zm9ZT2plNlNoNEFOT0libC8rMjQ2ckQrSEQ3d3owQS9MVFpZdDE3clZPR2VhQkUzUnpKdlZoQVgyUEJacXYvMjdTQTF2Vm95ZEVqenZjWUpZVW8xRHBOTWhENDBhR1JRZlhHZnE1ZXB6NGpYNHRaR0lna09DSm9qOWJXYjhhc1ZMMFZCeTd6QndqZjRkWU1IL25kU3NyTE5za3QwTVVsQ0tzVUM4eWVoL3plbk9CbzJuWE5WQ29YT0pjS0V6RStLZHpwQXBXeTh1YVFsYm5Ia3Mxak1KaG5TWi9mT0ppUWw2OFhSMTViUk13dVNSZjFabE4vQWNpSGRyOD0tLXYzRG11ZnU2UHN5RXcyRkZDTWI0elE9PQ%3D%3D--b4afc813c1e8748d8b74de9423bc0cda83a053b7"
        const cookie = "{_vinted_fr_session:" + cookie_value + "}"
        if (!cookie) {
            return reject('Could not fetch cookie');
        }
        if (!cachedCookie || cachedCookie.cookie !== cookie) {
            cookies.set(domain, {
                cookie,
                createdAt: Date.now()
            });
        }

        const controller = new AbortController();
        fetch(`https://www.vinted.be/api/v2/catalog/items?${querystring}`, {
            signal: controller.signal,
            agent: process.env.VINTED_API_HTTPS_PROXY ? new HttpsProxyAgent(process.env.VINTED_API_HTTPS_PROXY) : undefined,
            headers: {
                cookie: '_vinted_fr_session=' + cookie_value,
                'user-agent': new UserAgent().toString(),
                accept: 'application/json, text/plain, */*'
            }
        }).then((res) => {
            res.text().then((text) => {
                controller.abort();
                try {
                    resolve(JSON.parse(text));
                } catch (e) {
                    reject(text);
                }
            });
        }).catch(() => {
            controller.abort();
            reject('Can not fetch search API');
        });
    
    });
}
console.log("coucou")

module.exports = {
    fetchCookie,
    parseVintedURL,
    search
}
