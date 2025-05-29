export namespace main {
	
	export class WebhookResponse {
	    publicUrl: string;
	    port: number;
	
	    static createFrom(source: any = {}) {
	        return new WebhookResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.publicUrl = source["publicUrl"];
	        this.port = source["port"];
	    }
	}

}

