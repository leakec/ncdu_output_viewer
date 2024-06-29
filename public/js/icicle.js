import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
// import { data } from "./data.js";

export class Chart{
    num_layers = 3;
    width = 900;
    height = 900;
    data = null;

    conctructor() {
    }

    async init() {
        console.log(this.num_layers);
        this.data = await this.getData(0, this.num_layers-1);
    }

    async getData(nodeId, length) {
        return fetch(`http://localhost:3000/node/${nodeId}/${length}`).then(x=>x.json()).then(data=>data['0']['get_child_as_json']);
    }

    icicle() {

        // Helper function to set the rectangle height
        const rectHeight = (d) => {
            return d.x1 - d.x0 - Math.min(1, (d.x1 - d.x0) / 2);
        }

        // Helper function to decide whether a label is visible or not
        const labelVisible = (d) => {
            return d.y1 <= this.width && d.y0 >= 0 && d.x1 - d.x0 > 16;
        }

        // Create the SVG container.
        const svg = d3
            .create("svg")
            .attr("viewBox", [0, 0, this.width, this.height])
            .attr("width", this.width)
            .attr("height", this.height)
            .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;");

        // Compute the layout.
        let hierarchy = d3.hierarchy(this.data)

        // Use the pre-computed dsize as the nodes value.
        hierarchy.each(d => d.value = d.data.dsize);

        let root = d3
            .partition()
            .size([this.height, ((hierarchy.height + 1) * this.width) / this.num_layers])(hierarchy);

        const color = d3.scaleOrdinal(
            d3.quantize(d3.interpolateRainbow, this.data.children.length + 1),
        );

        // Append cells.
        let cell = svg
            .selectAll("g")
            .data(root.descendants())
            .join("g")
            .attr("transform", (d) => `translate(${d.y0},${d.x0})`);

        let text = cell
            .append("text")
            .style("user-select", "none")
            .attr("pointer-events", "none")
            .attr("x", 4)
            .attr("y", 13)
            .attr("fill-opacity", (d) => +labelVisible(d));

        let rect = cell
            .append("rect")
            .attr("width", (d) => d.y1 - d.y0 - 1)
            .attr("height", (d) => rectHeight(d))
            .attr("fill-opacity", 0.6)
            .attr("fill", (d) => {
                if (!d.depth) return "#ccc";
                while (d.depth > 1) d = d.parent;
                return color(d.data.name);
            })
            .style("cursor", "pointer");

        text.append("tspan").text((d) => d.data.name);

        let tspan = text
            .append("tspan")
            .attr("fill-opacity", (d) => labelVisible(d) * 0.7)
            .text((d) => " " + d.data.dsize_h);

        cell.append("title").text(
            (d) =>
            `${d
                    .ancestors()
                    .map((d) => d.data.name)
                    .reverse()
                    .join("/")}\n ${d.data.dsize_h}`,
        );

        let focus = root;

        const clicked = (_, p) => {
            const old_focus_id = focus.data.id;

            if (focus.data.id == p.data.id)
            {
                if (p.parent == null)
                {
                    // If the parent is null, we are at the root. Do nothing.
                    return;
                }

                // Going up the tree is easy. We don't need to get any new data. Just transition.
                p = p.parent;
                focus = focus === p ? (p = p.parent) : p;

                // Target the new focus
                root.each(
                    (d) =>
                    (d.target = {
                        x0: ((d.x0 - p.x0) / (p.x1 - p.x0)) * this.height,
                        x1: ((d.x1 - p.x0) / (p.x1 - p.x0)) * this.height,
                        y0: d.y0 - p.y0,
                        y1: d.y1 - p.y0,
                    }),
                );

                const t = cell
                    .transition()
                    .duration(750)
                    .attr(
                        "transform",
                        (d) => `translate(${d.target.y0},${d.target.x0})`,
                    );

                rect.transition(t).attr("height", (d) => rectHeight(d.target));
                text.transition(t).attr("fill-opacity", (d) => +labelVisible(d.target));
                tspan.transition(t).attr("fill-opacity", (d) => labelVisible(d.target) * 0.7);
            }
            else
            {
                // Going down the tree is complicated. Get new data. Redraw the current graph and then transition.
                focus = focus === p ? (p = p.parent) : p;
                this.getData(p.data.id, this.num_layers-1).then(new_data => {

                    // Append new data to the old data structure
                    let dark = p;
                    const p_ids = []
                    while (dark.data.id != 0)
                    {
                        p_ids.push(dark.data.id);
                        dark = dark.parent;
                    }

                    let x = this.data;
                    p_ids.slice(1).reverse().forEach(p_id => {
                        let dark = x.child_ids.findIndex((element) => element == p_id);
                        x = x.children[dark];
                    });

                    let dark2 = x.child_ids.findIndex((element) => element == p_ids[0]);
                    x.children[dark2] = new_data;

                    // Recompute the hierarchy and partition with the new data structure
                    hierarchy = d3.hierarchy(this.data)

                    // Use the pre-computed dsize as the nodes value.
                    hierarchy.each(d => d.value = d.data.dsize);

                    root = d3
                        .partition()
                        .size([this.height, ((hierarchy.height + 1) * this.width) / this.num_layers])(hierarchy);

                    let dark3 = root.descendants().find(d => d.data.id === old_focus_id);
                    const old_focus = {
                        x0: dark3.x0,
                        x1: dark3.x1,
                        y0: dark3.y0,
                        y1: dark3.y1,
                    };

                    // Target the old focus
                    root.each(
                        (d) =>
                        (d.target = {
                            x0: ((d.x0 - old_focus.x0) / (old_focus.x1 - old_focus.x0)) * this.height,
                            x1: ((d.x1 - old_focus.x0) / (old_focus.x1 - old_focus.x0)) * this.height,
                            y0: d.y0 - old_focus.y0,
                            y1: d.y1 - old_focus.y0,
                        }),
                    );

                    svg.selectAll("g").remove();

                    cell = svg
                        .selectAll("g")
                        .data(root.descendants())
                        .join("g")
                        .attr("transform", (d) => `translate(${d.y0},${d.x0})`);

                    text = cell
                        .append("text")
                        .style("user-select", "none")
                        .attr("pointer-events", "none")
                        .attr("x", 4)
                        .attr("y", 13)
                        .attr("fill-opacity", (d) => +labelVisible(d));

                    rect = cell
                        .append("rect")
                        .attr("width", (d) => d.y1 - d.y0 - 1)
                        .attr("height", (d) => rectHeight(d))
                        .attr("fill-opacity", 0.6)
                        .attr("fill", (d) => {
                            if (!d.depth) return "#ccc";
                            while (d.depth > 1) d = d.parent;
                            return color(d.data.name);
                        })
                        .style("cursor", "pointer")
                        .on("click", clicked);


                    text.append("tspan").text((d) => d.data.name);

                    tspan = text
                        .append("tspan")
                        .attr("fill-opacity", (d) => labelVisible(d) * 0.7)
                        .text((d) => " " + d.data.dsize_h);

                    cell.append("title").text(
                        (d) =>
                        `${d
                                .ancestors()
                                .map((d) => d.data.name)
                                .reverse()
                                .join("/")}\n ${d.data.dsize_h}`,
                    );

                    const t0 = cell
                        .transition()
                        .duration(0)
                        .attr(
                            "transform",
                            (d) => `translate(${d.target.y0},${d.target.x0})`,
                        );

                    rect.transition(t0).attr("height", (d) => rectHeight(d.target));
                    text.transition(t0).attr("fill-opacity", (d) => +labelVisible(d.target));
                    tspan.transition(t0).attr("fill-opacity", (d) => labelVisible(d.target) * 0.7);

                    // Target the new focus
                    root.each(
                        (d) =>
                        (d.target = {
                            x0: ((d.x0 - p.x0) / (p.x1 - p.x0)) * this.height,
                            x1: ((d.x1 - p.x0) / (p.x1 - p.x0)) * this.height,
                            y0: d.y0 - p.y0,
                            y1: d.y1 - p.y0,
                        }),
                    );

                    const t = cell
                        .transition()
                        .duration(750)
                        .attr(
                            "transform",
                            (d) => `translate(${d.target.y0},${d.target.x0})`,
                        );

                    rect.transition(t).attr("height", (d) => rectHeight(d.target));
                    text.transition(t).attr("fill-opacity", (d) => +labelVisible(d.target));
                    tspan.transition(t).attr("fill-opacity", (d) => labelVisible(d.target) * 0.7);
                });
            }
        }

        // Set the callback function
        rect.on("click", clicked);

        return svg.node();
    }
}

