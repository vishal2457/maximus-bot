import axios, { type AxiosRequestConfig } from "axios";
import { toast } from "sonner";
import type { ApiResponse } from "../models/api-response";

const apiURL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const instance = axios.create({
	baseURL: `${apiURL}/api`,
	timeout: 60000, // Increased timeout for streaming responses
});

instance.interceptors.request.use(
	(config) => {
		// Check for both possible token keys
		const token = localStorage.getItem("accessToken") || localStorage.getItem("AUTH_TOKEN");
		if (token) {
			config.headers["Authorization"] = `Bearer ${token}`;
		}
		return config;
	},
	(error) => {
		return Promise.reject(error);
	},
);

instance.interceptors.response.use(
	(response) => response,
	(error) => {
		if (error.response?.status === 401) {
			// eslint-disable-next-line no-console
			console.error("Unauthorized: Redirecting to login...");
			localStorage.clear();
			window.location.href = "/login";
			return;
		}
		toast.error(error.response?.data?.message || "An error occurred");
		return Promise.reject(error);
	},
);

const baseApi = {
	get: <T>(url: string, config?: AxiosRequestConfig) => {
		return instance.get<ApiResponse<T>>(url, config);
	},
	post: <T>(url: string, data?: any, config?: AxiosRequestConfig) => {
		return instance.post<ApiResponse<T>>(url, data, config);
	},
	put: <T>(url: string, data?: any, config?: AxiosRequestConfig) => {
		return instance.put<ApiResponse<T>>(url, data, config);
	},
	patch: <T>(url: string, data?: any, config?: AxiosRequestConfig) => {
		return instance.patch<ApiResponse<T>>(url, data, config);
	},
	delete: <T>(url: string, config?: AxiosRequestConfig) => {
		return instance.delete<ApiResponse<T>>(url, config);
	},
};



export default baseApi;
