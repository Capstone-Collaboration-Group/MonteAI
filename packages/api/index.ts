import axios from "axios";

export const createApiClient = (baseURL: string) => {
    return axios.create({
        baseURL,
        timeout: 10000
    });
};

