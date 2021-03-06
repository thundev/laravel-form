import isObject from 'lodash.isobject/index';
import { AxiosError, AxiosResponse } from 'axios';
import Errors from './Errors';
import Request from './Request';

export enum FormMethods {
    POST = 'post',
    PATCH = 'patch',
    PUT = 'put',
}

export interface FormConfig {
    resetAfterSend?: boolean,
    removeNullValues?: boolean,
    method?: FormMethods,
    request?: Request,
}

export interface FormProperties {
    [key: string]: any
}

export default class Form {
    [key: string]: any;

    private readonly originalData: FormProperties;

    private readonly config: FormConfig;

    public errors: Errors;

    private request: Request;

    /**
     * Create a new Form instance.
     */
    constructor(data: FormProperties, config: FormConfig = {}) {
        this.config = {
            resetAfterSend: true,
            removeNullValues: true,
            method: FormMethods.POST,
            ...config,
        };

        Object.keys(data).forEach((key) => {
            this[key] = data[key];
        });

        this.originalData = { ...data };
        this.errors = new Errors();
        this.request = this.config.request ?? Request.getInstance();

        if (this.config.method !== FormMethods.POST) {
            this.addField('_method', this.config.method);
        }
    }

    /**
     * Add a new field with value to the form.
     */
    public addField(field: string, value: any): void {
        this.originalData[field] = value;
        this[field] = value;
    }

    /**
     * Serialize the Form.
     */
    public serialize(asString: boolean = true): string|object {
        const json: { [key: string]: any } = {};

        Object.keys(this.originalData).forEach((field: string) => {
            json[field] = this[field];
        });

        return asString ? JSON.stringify(json) : json;
    }

    /**
     * Submit the form.
     */
    public submit(url: string): Promise<any> {
        this.errors.clear();
        const data = this.getFormData();
        const config = { headers: { 'Content-Type': 'multipart/form-data' } };

        return new Promise((resolve, reject) => {
            this.request.post(url, data, config)
                .then((response: AxiosResponse) => {
                    if (this.config.resetAfterSend) {
                        this.reset();
                    }
                    return resolve(response.data);
                })
                .catch((error: AxiosError) => {
                    if (typeof error.response?.data.errors !== 'undefined') {
                        this.errors.record(error.response.data.errors);
                    }
                    return reject(error.response?.data);
                });
        });
    }

    /**
     * Get FormData object.
     */
    public getFormData(): FormData {
        const formData = new FormData();

        Object.keys(this.originalData).forEach((field) => {
            const value = this[field];

            if (value === null && this.config.removeNullValues) {
                return;
            }

            if (
                typeof value === 'string'
                && value.length === 0
                && this.config.removeNullValues
            ) {
                return;
            }

            if (typeof value === 'boolean') {
                formData.append(field, Number(value).toString());
                return;
            }

            if (Array.isArray(value)) {
                this.addArray(field, value, formData);
                return;
            }

            if (isObject(value) && !(value instanceof File)) {
                this.addObject(field, value, formData);
                return;
            }

            formData.append(field, value);
        });

        return formData;
    }

    /**
     * Reset the state of the form to the original state and clears errors.
     */
    private reset(): void {
        Object.keys(this.originalData).forEach((field) => {
            this[field] = this.originalData[field];
        });

        this.errors.clear();
    }

    private addArray(field: string, array: any[], formData: FormData) {
        if (array.length === 0 && this.config.removeNullValues) {
            return;
        }

        array.forEach((item) => {
            formData.append(`${field}[]`, item);
        });
    }

    private addObject(field: string, object: { [key: string]: any }, formData: FormData) {
        const keys = Object.keys(object);

        if (keys.length === 0 && this.config.removeNullValues) {
            return;
        }

        keys.forEach((key) => {
            formData.append(`${field}[${key}]`, object[key]);
        });
    }
}
