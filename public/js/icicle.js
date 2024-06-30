import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
// import { data } from "./data.js";

export class Chart{
    num_layers = 3;
    width = 1000;
    height = 750;
    data = null;
    hierarchy = null;
    root = null;
    svg = null;
    color = null;
    focus = null;

    // For selecting the data type: dsize or asize
    data_type_select = document.createElement("Select");
    data_type = "dsize";
    data_type_h = "dsize_h";

    // For selecting the chart type
    chart_type_select = document.createElement("Select");
    chart_type = "icicle";

    // Current plot to draw
    plot = null;

    constructor() {
        // For selecting the chart type
        this.chart_type_select.add( new Option("icicle", "icicle", true, true) );
        this.chart_type_select.add( new Option("sunburst", "sunburst") );
        this.chart_type_select.add( new Option("treemap", "treemap") );
        this.chart_type_select.addEventListener("change", () => {
            this.chart_type = this.data_type_select.value;
        });
        this.chart_type_select.style.position = "absolute";
        this.chart_type_select.style.top = '10px';
        this.chart_type_select.style.left = '10px';

        // For selecting the data type
        this.data_type_select.add( new Option("dsize", "dsize", true, true) );
        this.data_type_select.add( new Option("asize", "asize") );
        this.data_type_select.addEventListener("change", () => {
            this.data_type = this.data_type_select.value;
            this.data_type_h = this.data_type + "_h";
            this.plot.redraw();
        });
        this.data_type_select.style.position = "absolute";
        this.data_type_select.style.top = '10px';
        this.data_type_select.style.left = '120px';
    }

    async init() {
        this.data = await this.getData(0, this.num_layers-1);
        this.plot = new Icicle(this);
    }

    async getData(nodeId, length) {
        return fetch(`http://localhost:3000/node/${nodeId}/${length}`).then(x=>x.json()).then(data=>data['0']['get_child_as_json']);
    }

    computeHierarcy() {
        // Recompute the hierarchy and partition with the new data structure
        this.hierarchy = d3.hierarchy(this.data)

        // Use the pre-computed data_type as the nodes value.
        this.hierarchy.each(d => d.value = d.data[this.data_type]);

        // Compute colors based on the data
        this.color = d3.scaleOrdinal(
            d3.quantize(d3.interpolateRainbow, this.data.children.length + 1),
        );
    }
}

class Icicle {
    chart = null;
    cell = null;
    rect = null;
    text = null;
    tspan = null;
    old_focus_id = null;

    constructor(chart)
    {
        this.chart = chart;

        this.chart.svg = d3
            .create("svg")
            .attr("viewBox", [0, 0, this.chart.width, this.chart.height])
            .attr("width", this.chart.width)
            .attr("height", this.chart.height)
            .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif; position: absolute; top: 50px;");

        this.draw();
    }

    // Helper function to set the rectangle height
    rectHeight(d) {
        return d.x1 - d.x0 - Math.min(1, (d.x1 - d.x0) / 2);
    }

    // Helper function to decide whether a label is visible or not
    labelVisible(d) {
        return d.y1 <= this.chart.width && d.y0 >= 0 && d.x1 - d.x0 > 16;
    }

    draw() {
        // Recompute hierarcy for data
        this.chart.computeHierarcy()

        this.chart.root = d3
            .partition()
            .size([this.chart.height, ((this.chart.hierarchy.height + 1) * this.chart.width) / this.chart.num_layers])(this.chart.hierarchy);

        // Append cells.
        this.cell = this.chart.svg
            .selectAll("g")
            .data(this.chart.root.descendants())
            .join("g")
            .attr("transform", (d) => `translate(${d.y0},${d.x0})`);

        this.text = this.cell
            .append("text")
            .style("user-select", "none")
            .attr("pointer-events", "none")
            .attr("x", 4)
            .attr("y", 13)
            .attr("fill-opacity", (d) => +this.labelVisible(d));

        this.rect = this.cell.append("rect")
            .attr("width", (d) => d.y1 - d.y0 - 1)
            .attr("height", (d) => this.rectHeight(d))
            .attr("fill-opacity", 0.6)
            .attr("fill", (d) => {
                if (!d.depth) return "#ccc";
                while (d.depth > 1) d = d.parent;
                return this.chart.color(d.data.name);
            })
            .style("cursor", "pointer")

        this.text.append("tspan").text((d) => d.data.name);

        this.tspan = this.text.append("tspan")
            .attr("fill-opacity", (d) => this.labelVisible(d) * 0.7)
            .text((d) => " " + d.data[this.chart.data_type_h]);

        this.cell.append("title").text(
            (d) =>
            `${d
                    .ancestors()
                    .map((d) => d.data.name)
                    .reverse()
                    .join("/")}\n ${d.data[this.chart.data_type_h]}`,

        );

        // TODO: Put this elsewhere
        if (this.chart.focus == null)
        {
            this.chart.focus = this.chart.root;
        }

        const clicked = (_, p) => {
            this.old_focus_id = this.chart.focus.data.id;
            if (this.chart.focus.data.id == p.data.id)
            {
                if (p.parent == null)
                {
                    // If the parent is null, we are at the root. Do nothing.
                    return;
                }

                // Going up the tree is easy. We don't need to get any new data. Just transition.
                p = p.parent;
                this.chart.focus = this.chart.focus === p ? (p = p.parent) : p;

                this.transition(p, 750);
            }
            else
            {
                // Going down the tree is complicated. Get new data. Redraw the current graph and then transition.
                this.chart.focus = this.chart.focus === p ? (p = p.parent) : p;
                this.chart.getData(p.data.id, this.chart.num_layers-1).then(new_data => {

                    // Append new data to the old data structure
                    let dark = p;
                    const p_ids = []
                    while (dark.data.id != 0)
                    {
                        p_ids.push(dark.data.id);
                        dark = dark.parent;
                    }

                    let x = this.chart.data;
                    p_ids.slice(1).reverse().forEach(p_id => {
                        let dark = x.child_ids.findIndex((element) => element == p_id);
                        x = x.children[dark];
                    });

                    let dark2 = x.child_ids.findIndex((element) => element == p_ids[0]);
                    x.children[dark2] = new_data;

                    // Redraw the chart at the old focus
                    let dark3 = this.chart.root.descendants().find(d => d.data.id === this.old_focus_id);
                    const old_focus = {
                        x0: dark3.x0,
                        x1: dark3.x1,
                        y0: dark3.y0,
                        y1: dark3.y1,
                    };

                    this.redraw(old_focus);

                    // Transition to the new spot
                    this.transition(p, 750);
                });
            }
        };

        this.rect.on("click", clicked);
    }

    redraw(focus=null) {
        if (focus == null)
        {
            focus = this.chart.focus;
        }
        this.chart.svg.selectAll("g").remove();
        this.draw();
        this.transition(focus, 0);
    }

    transition(p, time) {
        // Target the new focus
        this.chart.root.each(
            (d) =>
            (d.target = {
                x0: ((d.x0 - p.x0) / (p.x1 - p.x0)) * this.chart.height,
                x1: ((d.x1 - p.x0) / (p.x1 - p.x0)) * this.chart.height,
                y0: d.y0 - p.y0,
                y1: d.y1 - p.y0,
            }),
        );

        const t = this.cell
            .transition()
            .duration(time)
            .attr(
                "transform",
                (d) => `translate(${d.target.y0},${d.target.x0})`,
            );

        this.rect.transition(t).attr("height", (d) => this.rectHeight(d.target));
        this.text.transition(t).attr("fill-opacity", (d) => +this.labelVisible(d.target));
        this.tspan.transition(t).attr("fill-opacity", (d) => this.labelVisible(d.target) * 0.7);
    }

}
