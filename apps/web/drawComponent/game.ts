import { getExistingShapes } from "./httpRequest";
import { Tool } from '../canvas/Canavas'

type shape = {
    type: "rect";
    x: number;
    y: number;
    width: number;
    height: number;
} | {
    type: "circle";
    centerX: number;
    centerY: number;
    radius: number;
} | {
    type: "pencil";
    points: { x: number, y: number }[] | [];
} | {
    type: "line";
    startX: number;
    startY: number;
    endX: number;
    endY: number;
} | {
    type: "arrow";
    startX: number;
    startY: number;
    endX: number;
    endY: number;
} 

export class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private existingShapes: shape[] = [];
    private roomId: string;
    private clicked: boolean = false;
    private startX: number = 0;
    private startY: number = 0;
    private selectedTool: Tool = "rect";
    socket: WebSocket;
    private currentPencilShape: shape | null = null;

    constructor(canvas: HTMLCanvasElement, roomId: string, socket: WebSocket) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d")!;
        this.roomId = roomId;
        this.socket = socket;
        this.init();
        this.initHandlers();
        this.initMouseHandlers();
    }

    destroy() {
        this.canvas.removeEventListener("mousedown", this.mouseDownHandler);
        this.canvas.removeEventListener("mouseup", this.mouseUpHandler);
        this.canvas.removeEventListener("mousemove", this.mouseMoveHandler);
    }

    async init() {
        this.existingShapes = await getExistingShapes(this.roomId);
        this.drawCanvas();
    }

    initHandlers() {
        this.socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === "chat") {
                    const receivedShape: shape = JSON.parse(message.message);
                    this.existingShapes.push(receivedShape);
                    this.drawCanvas();
                }
                this.drawCanvas();
            } catch (error) {
                console.error("❌ Error parsing WebSocket message:", error);
            }
        };
    }

    drawCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const bgColor = window.selectedBackgroundColor;
        this.ctx.fillStyle = `${bgColor}`;
        console.log("this.ctx fill style", this.ctx.fillStyle);
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        for (const shape of this.existingShapes) {
            if (shape.type === "rect") {
                const strokeStyle = window.selectedStrokeColor;
                this.ctx.strokeStyle = `${strokeStyle}`;
                this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
            } else if (shape.type === "circle") {
                this.ctx.beginPath();
                this.ctx.arc(shape.centerX, shape.centerY, Math.abs(shape.radius), 0, 2 * Math.PI);
                this.ctx.stroke();
                this.ctx.closePath();
            } else if (shape.type === "line") {
                this.ctx.beginPath();
                this.ctx.moveTo(shape.startX, shape.startY);
                this.ctx.lineTo(shape.endX, shape.endY);
                this.ctx.stroke();
                this.ctx.closePath();
            } else if (shape.type === "arrow") {
                this.drawArrow(shape.startX, shape.startY, shape.endX, shape.endY);
            } else if (shape.type === "pencil") {
                this.ctx.beginPath();
                const points = shape.points ;
                if (points && points.length > 1 && points[0]) {
                    this.ctx.moveTo(points[0].x, points[0].y);
                    points.forEach((point) => {
                        this.ctx.lineTo(point.x, point.y);
                    });
                    this.ctx.stroke();
                }
                this.ctx.closePath();
            }
        }
    }

    drawArrow(startX: number, startY: number, endX: number, endY: number) {
        const angle = Math.atan2(endY - startY, endX - startX);
        const arrowLength = 10;
        const arrowAngle = Math.PI / 6;

        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);

        // Drawing arrowhead
        this.ctx.moveTo(endX, endY);
        this.ctx.lineTo(endX - arrowLength * Math.cos(angle - arrowAngle), endY - arrowLength * Math.sin(angle - arrowAngle));
        this.ctx.moveTo(endX, endY);
        this.ctx.lineTo(endX - arrowLength * Math.cos(angle + arrowAngle), endY - arrowLength * Math.sin(angle + arrowAngle));

        this.ctx.stroke();
        this.ctx.closePath();
    }

    updateBackgroundColor() {
        this.drawCanvas();
    }

    mouseDownHandler = (e: MouseEvent) => {
        this.clicked = true;
        this.startX = e.offsetX;
        this.startY = e.offsetY;

        if (window.selectedTool === "pencil") {
            // Always create a fresh new pencil shape
            this.currentPencilShape = {
                type: "pencil",
                points: [{
                    x: this.startX,
                    y: this.startY
                }]
            };
            this.existingShapes.push(this.currentPencilShape);
        }
    };

    mouseMoveHandler = (e: MouseEvent) => {
        if (this.clicked) {
            const width = e.offsetX - this.startX;
            const height = e.offsetY - this.startY;
            this.drawCanvas();
            const strokeColor = window.selectedStrokeColor;
            this.ctx.strokeStyle = `${strokeColor}`;

            if (window.selectedTool === "rect") {
                this.ctx.strokeRect(this.startX, this.startY, width, height);
            } else if (window.selectedTool === "circle") {
                const radius = Math.max(width, height) / 2;
                const centerX = this.startX + radius;
                const centerY = this.startY + radius;
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, Math.abs(radius), 0, 2 * Math.PI);
                this.ctx.stroke();
                this.ctx.closePath();
            } else if (window.selectedTool === "line") {
                this.ctx.beginPath();
                this.ctx.moveTo(this.startX, this.startY);
                this.ctx.lineTo(e.offsetX, e.offsetY);
                this.ctx.stroke();
                this.ctx.closePath();
            } else if (window.selectedTool === "arrow") {
                this.drawArrow(this.startX, this.startY, e.offsetX, e.offsetY);
            } else if (window.selectedTool === "pencil") {
                // Add points only to the current active pencil shape
                if (this.currentPencilShape) {
                    (this.currentPencilShape as { type: "pencil"; points: { x: number, y: number }[] }).points.push({
                        x: e.offsetX,
                        y: e.offsetY
                    });
                    this.drawCanvas();
                }
            }
        }
    };

    updateStrokeColor() {
        this.drawCanvas();
    }

    mouseUpHandler = (e: MouseEvent) => {
        this.clicked = false;

        if (window.selectedTool === "pencil" && this.currentPencilShape) {
            this.socket.send(
                JSON.stringify({
                    type: "chat",
                    message: JSON.stringify(this.currentPencilShape),
                    roomId: this.roomId,
                })
            );
            this.currentPencilShape = null; // Reset to ensure fresh drawing next time
            return;
        }

        const width = e.offsetX - this.startX;
        const height = e.offsetY - this.startY;

        let shape: shape | null = null;

        if (window.selectedTool === "rect") {
            shape = {
                type: "rect",
                x: this.startX,
                y: this.startY,
                width,
                height
            };
        } else if (window.selectedTool === "circle") {
            const radius = Math.max(width, height) / 2;
            shape = {
                type: "circle",
                centerX: this.startX + radius,
                centerY: this.startY + radius,
                radius
            };
        } else if (window.selectedTool === "line") {
            shape = {
                type: "line",
                startX: this.startX,
                startY: this.startY,
                endX: e.offsetX,
                endY: e.offsetY
            };
        } else if (window.selectedTool === "arrow") {
            shape = {
                type: "arrow",
                startX: this.startX,
                startY: this.startY,
                endX: e.offsetX,
                endY: e.offsetY
            };
        }

        if (shape) {
            this.existingShapes.push(shape);

            this.socket.send(
                JSON.stringify({
                    type: "chat",
                    message: JSON.stringify(shape),
                    roomId: this.roomId,
                })
            );

            this.drawCanvas();
        }
    };

    initMouseHandlers() {
        this.canvas.addEventListener("mousedown", this.mouseDownHandler.bind(this));
        this.canvas.addEventListener("mouseup", this.mouseUpHandler.bind(this));
        this.canvas.addEventListener("mousemove", this.mouseMoveHandler.bind(this));
    }
}
