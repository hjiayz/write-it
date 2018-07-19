import React, { Component } from "react";
import { BrowserRouter as Router, Route, Link } from "react-router-dom";
import "./App.css";
import "bulma/css/bulma.css";
import yaml from "js-yaml";
let root = process.env.PUBLIC_URL;
let BrowserFS = window.BrowserFS;
let git = window.git;
let Home = fs => {
  return class extends Component {
    constructor(props) {
      super(props);
      this.state = {};
    }
    componentDidMount() {
      fs.readdir("/", (err, files) => {
        this.setState({ files: files });
      });
    }
    render() {
      return (
        <aside className="menu">
          <ul className="menu-list">
            <li>
              <Link to={`${root}/new`}>新项目</Link>
            </li>
          </ul>
          <p className="menu-label">项目列表</p>
          <ul className="menu-list">
            {(this.state.files || []).map(filename => {
              return (
                <li key={filename}>
                  <Link to={`${root}/project/${filename}`}>{filename}</Link>
                </li>
              );
            })}
          </ul>
        </aside>
      );
    }
  };
};
const NewProject = fs => {
  return class extends Component {
    constructor(props) {
      super(props);
      this.state = {};
    }
    componentDidMount() {}
    onSubmit = () => {
      let name = this.state.name;
      if (typeof name !== "string" || name === "") {
        this.setState({ help: "项目名称不能为空" });
        return;
      }
      this.setState({ Loading: true });
      fs.exists(name, exist => {
        if (exist) {
          this.setState({ help: "项目已存在", Loading: false });
        } else {
          fs.mkdir(`/${name}`, 0x777, err => {
            if (!!err) {
              this.setState({ help: err, Loading: false });
            } else {
              git.init({ fs: fs, dir: `/${name}/` }).then(() => {
                this.props.history.push(`${root}/options/${name}`, {});
              });
            }
          });
        }
      });
    };
    render() {
      return (
        <aside>
          <div className="field">
            <label className="label">项目名称</label>
            <div className="control">
              <input
                className="input"
                type="text"
                placeholder="项目名称"
                value={this.state.name || ""}
                onChange={e => this.setState({ name: e.target.value })}
              />
            </div>
            <p className="help is-danger">{this.state.help}</p>
          </div>
          <div className="control">
            <div className="buttons has-addons">
              <button
                className={"button is-primary" + (this.state.Loading ? " is-loading" : "")}
                onClick={this.onSubmit}>
                确认
              </button>
              <Link className="button" to={`${root}/`}>
                返回主页
              </Link>
            </div>
          </div>
        </aside>
      );
    }
  };
};
let TabBar = ({ kind, id }) => (
  <div className="tabs">
    <ul>
      <li>
        <Link to={`${root}/`}>主页</Link>
      </li>
      {["project", "options", "view"].map(v => {
        let labels = {
          project: "添加",
          options: "选项",
          view: "浏览"
        };
        return (
          <li key={v} className={kind === v ? "is-active" : ""}>
            <Link to={`${root}/${v}/${id}`}>{labels[v]}</Link>
          </li>
        );
      })}
    </ul>
  </div>
);
let Project = fs => {
  return class extends Component {
    constructor(props) {
      super(props);
      this.state = { value: {}, schema: [], autocomplete: {} };
    }
    componentDidMount() {
      fs.readFile(`/${this.props.match.params.id}/template.yaml`, (err, buffer) => {
        if (!!err) {
          this.setState({ err: "读取配置文件失败，请设置" });
        } else {
          let schema = yaml.load(buffer.toString());
          this.setState({ schema: schema });
        }
      });
    }
    buttonColor = () => {
      let value = this.state.value;
      let schema = this.state.schema;
      for (let field of schema) {
        let field_value = value[field[0]];
        if (field.indexOf(field_value, 1) === -1) return "is-warning";
      }
      return "is-primary";
    };
    onHiddenAutoComplete = title => () => {
      this.setState(p => ({
        autocomplete: Object.assign({}, p.autocomplete, { [title]: null })
      }));
    };
    onShowAutoComplete = title => () => {
      let schema = this.state.schema.find(v => v[0] === title);
      let autocomplete = schema
        .slice(1)
        .filter(val => {
          let value = this.state.value[title] || "";
          return val.indexOf(value) !== -1;
        })
        .slice(0, 10)
        .map((v, i) => {
          let value = this.state.value[title] || "";
          let splits = v.split(value);
          return {
            view: splits.map((val, i) => {
              return (
                <React.Fragment key={i}>
                  {i === 0 ? null : <strong className="has-text-primary">{value}</strong>}
                  {val}
                </React.Fragment>
              );
            }),
            value: v
          };
        });
      this.setState(p => ({
        autocomplete: Object.assign({}, p.autocomplete, { [title]: autocomplete })
      }));
    };
    onChange = title => e => {
      let value = e.target.value;
      this.setState(
        p => ({ value: { ...p.value, [title]: value } }),
        () => {
          this.onShowAutoComplete(title)();
        }
      );
    };
    onSubmit = _ => {
      let file = "data.yaml";
      let dir = `/${this.props.match.params.id}`;
      let repo = { fs, dir: dir };
      let path = `${dir}/${file}`;
      let data = yaml.safeDump([this.state.value]);
      (async () => {
        await new Promise((res, err) =>
          fs.appendFile(path, data, function(err) {
            if (err) throw err;
            res();
          })
        );
        await git.add({ ...repo, filepath: file });
        let sha = await git.commit({
          ...repo,
          message: `Update ${path}`
        });
        return sha;
      })()
        .then(res => {
          this.setState({value:{}})
        })
        .catch(_ => null);
    };
    render() {
      return (
        <div>
          <TabBar kind="project" id={this.props.match.params.id} />
          {this.state.err ? <div>{this.state.err.toString()}</div> : null}
          {this.state.schema.map((v, i) => {
            let title = v[0];
            return (
              <div key={i}>
                <div className="field">
                  <label className="label">{title}</label>
                  <div className="control">
                    <input
                      className="input"
                      type="text"
                      placeholder={`在此输入${title}`}
                      value={this.state.value[title] || ""}
                      onChange={this.onChange(title)}
                      onBlur={this.onHiddenAutoComplete(title)}
                      onFocus={this.onShowAutoComplete(title)}
                    />
                  </div>
                </div>
                {!!this.state.autocomplete[title] ? (
                  <div className="tags">
                    {this.state.autocomplete[title].map((value, i) => (
                      <span
                        className="tag"
                        key={i}
                        onClick={_ => this.onChange(title)({ target: { value: value.value } })}
                        onMouseDown={e => {
                          e.preventDefault();
                        }}>
                        {value.view}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
          <button className={`button ${this.buttonColor()}`} onClick={this.onSubmit}>
            提交
          </button>
        </div>
      );
    }
  };
};
let Options = fs => {
  return class extends Component {
    constructor(props) {
      super(props);
      //modified保存原始值，added标注新增的行，deleted标注删除的行
      this.state = { modified: {}, added: {}, deleted: {}, expanded: {} };
    }
    loadSchema = () => {
      let dir = `/${this.props.match.params.id}`;
      let repo = { fs, dir: dir };
      git
        .config({
          ...repo,
          path: "user.name"
        })
        .then(name => {
          this.setState({ name: name });
        })
        .catch(_ => {
          this.setState({ name: "test" });
        });
      git
        .config({
          ...repo,
          path: "user.email"
        })
        .then(email => {
          this.setState({ email: email });
        })
        .catch(_ => {
          this.setState({ name: "test@test.org" });
        });
      git
        .config({
          ...repo,
          path: "user.password"
        })
        .then(password => {
          this.setState({ password: password });
        })
        .catch(_ => {
          this.setState({ password: "" });
        });
      git
        .config({
          ...repo,
          path: "remote.origin.url"
        })
        .then(url => {
          this.setState({ url: url });
        })
        .catch(_ => {
          this.setState({ url: "" });
        });
      fs.readFile(`/${this.props.match.params.id}/template.yaml`, (err, buffer) => {
        if (!!err) {
          this.setState({ schema: [[""]] });
        } else {
          let schema = yaml.load(buffer.toString());
          this.setState({ modified: {}, added: {}, deleted: {}, schema: schema.map(v => v.concat("")).concat([[""]]) });
        }
      });
    };
    componentDidMount() {
      this.loadSchema();
    }
    addItem = e => {
      let value = e.target.value;
      this.setState(p => ({
        schema: p.schema.concat([[value]])
      }));
    };

    onChange = (col, row) => e => {
      let value = e.target.value;
      this.setState(p => {
        let key = col + "," + row;
        let newschema = Object.assign([], p.schema);
        let newmodified = Object.assign({}, p.modified);
        let newadded = Object.assign({}, p.added);
        newschema[col] = Object.assign([], p.schema[col]);
        if (!newmodified[key]) {
          newmodified[key] = newschema[col][row] || "";
        }
        newschema[col][row] = value;
        if (row === newschema[col].length - 1) {
          newschema[col].push("");
          newadded[key] = true;
        }
        if (col === newschema.length - 1) {
          newschema.push([""]);
        }
        return {
          schema: newschema,
          modified: newmodified,
          added: newadded
        };
      });
    };
    expandedItemSwitch = item => _ => {
      this.setState(p => ({
        expanded: Object.assign({}, p.expanded, { [item]: !p.expanded[item] })
      }));
    };
    onDeleteItem = item => _ => {
      this.setState(p => ({
        deleted: Object.assign({}, p.deleted, { [item]: true })
      }));
    };
    onCancelDeleteItem = item => _ => {
      this.setState(p => ({
        deleted: Object.assign({}, p.deleted, { [item]: false })
      }));
    };
    onRestoreItem = item => _ => {
      let [col, row] = item.split(",");
      this.setState(p => {
        let newschema = Object.assign([], p.schema);
        newschema[col] = Object.assign([], p.schema[col]);
        newschema[col][row] = p.modified[item];
        return {
          schema: newschema,
          modified: Object.assign({}, p.modified, { [item]: null })
        };
      });
    };
    conflict = () => {
      let fieldmap = [];
      let fields = [];
      let keysfirst = {};
      let keys = {};
      let result = {};
      for (let col in this.state.schema) {
        let rows = this.state.schema[col];
        for (let row in rows) {
          let key = col + "," + row;
          let str = rows[row];
          let isdeleted = this.state.deleted[key] || this.state.deleted[col + "," + 0];
          if (isdeleted) {
            continue;
          }
          if (row === "0") {
            keys[str] = (keys[str] || 0) + 1;
            keysfirst[str] = keysfirst[str] || col;
            fieldmap[col] = keysfirst[str];
            continue;
          }
          let mapcol = fieldmap[col];
          fields[mapcol] = fields[mapcol] || {};
          fields[mapcol][str] = (fields[mapcol][str] || 0) + 1;
        }
      }
      for (let col in this.state.schema) {
        let rows = this.state.schema[col];
        for (let row in rows) {
          let str = rows[row];
          let key = col + "," + row;
          if (row === "0") {
            result[key] = keys[str] > 1;
          } else {
            let mapcol = fieldmap[col];
            result[key] = (fields[mapcol] || {})[str] > 1;
          }
        }
      }
      return result;
    };
    onSubmit = () => {
      let schema = Object.assign([], this.state.schema);
      let keys = {};
      for (let col in schema) {
        let key = schema[col][0];
        if (keys[key] !== undefined) {
          schema[keys[key]] = schema[keys[key]].concat(schema[col].slice(1));
          schema[col] = [];
        } else {
          keys[key] = col;
        }
      }
      schema = schema.map(row => row.filter(item => item !== ""));
      schema = schema.filter(row => row.length > 0);
      for (let col in schema) {
        let rows = schema[col];
        let items = {};
        let newrows = rows.filter((item, row) => {
          let key = col + "," + row;
          let isdeleted = this.state.deleted[key] || this.state.deleted[col + "," + 0];
          if (isdeleted) return false;
          if (row === 0) return true;
          if (items[item]) {
            return false;
          } else {
            items[item] = true;
            return true;
          }
        });
        schema[col] = newrows;
      }
      schema = schema.filter(row => row.length > 0);
      let data = yaml.safeDump(schema);
      let dir = `/${this.props.match.params.id}`;
      let file = `template.yaml`;
      let path = `${dir}/${file}`;
      let repo = { fs, dir: dir };
      (async () => {
        await new Promise((res, err) =>
          fs.writeFile(path, data, err => {
            if (err) throw err;
            res();
          })
        );
        await git.add({ ...repo, filepath: file });
        await git.config({
          ...repo,
          path: "user.name",
          value: this.state.name || "test"
        });
        await git.config({
          ...repo,
          path: "user.email",
          value: this.state.email || "test@test.org"
        });
        await git.config({
          ...repo,
          path: "user.password",
          value: this.state.password
        });
        await git.config({
          ...repo,
          path: "remote.origin.url",
          value: this.state.url
        });
        await git.config({
          ...repo,
          path: "remote.origin.fetch",
          value: "+refs/heads/*:refs/remotes/origin/*"
        });
        let sha = await git.commit({
          ...repo,
          message: `Update ${path}`
        });
        return sha;
      })()
        .then(res => {
          this.loadSchema();
        })
        .catch(_ => null);
    };
    onPullAndPush = () => {
      let dir = `/${this.props.match.params.id}`;
      let repo = { fs, dir: dir };
      this.setState({ sync_state: "loading" });
      (async () => {
        try {
          await git.pull({
            ...repo,
            username: this.state.name,
            password: this.state.password,
            ref: "master",
            singleBranch: true
          });
        } catch (e) {
          if (e.code !== "ResolveRefError") throw e;
        }
        let pushResponse = await git.push({
          ...repo,
          username: this.state.name,
          password: this.state.password,
          remote: "origin",
          ref: "master",
          token: process.env.GITHUB_TOKEN
        });
        return pushResponse;
      })()
        .then(res => {
          this.loadSchema();
          this.setState({ sync_state: null });
        })
        .catch(e => {
          this.setState({ sync_state: "faild" });
        });
    };
    render() {
      let conflict = this.conflict();
      let box = null;
      if (!!this.state.schema) {
        box = this.state.schema.map((v, col) => {
          let isexpanded = this.state.expanded[col];
          return v.map((items, row) => {
            if (row !== 0 && !isexpanded) return null;
            let placeholder = "";
            let isfield = row === 0;
            let isaddbox = row === v.length - 1;
            if (isaddbox) {
              placeholder = "添加内容";
            }
            if (col === this.state.schema.length - 1) {
              placeholder = "添加字段";
            }
            let key = col + "," + row;
            let isdeleted = this.state.deleted[key] || this.state.deleted[col + "," + 0];
            let ismodified = this.state.modified[key];
            let isadded = this.state.added[key];
            let isconflict = conflict[key];
            let addons = false;
            let fieldbutton = null;
            let color = "";
            if (!!ismodified) {
              color = " is-info";
            }
            if (isadded) {
              color = " is-success";
            }
            if (isconflict) {
              color = " is-warning";
            }
            let inputview = (
              <input
                className={"input" + color}
                type="text"
                value={items}
                onChange={this.onChange(col, row)}
                placeholder={placeholder}
              />
            );
            let rightbutton = (
              <p className="control">
                <a className={"button" + color} onClick={this.onDeleteItem(key)}>
                  删除
                </a>
              </p>
            );
            if (!!ismodified && !isadded) {
              rightbutton = (
                <p className="control">
                  <a className={"button" + color} onClick={this.onRestoreItem(key)}>
                    还原
                  </a>
                </p>
              );
            }
            if (isdeleted) {
              color = " is-danger";
              inputview = <del className={"input" + color}>{items}</del>;
              rightbutton = (
                <p className="control">
                  <a className={"button" + color} onClick={this.onCancelDeleteItem(key)}>
                    恢复
                  </a>
                </p>
              );
              if (isaddbox) return null;
            }
            if (isaddbox) {
              rightbutton = null;
            } else {
              addons = true;
            }
            if (isfield && !isaddbox) {
              addons = true;
              fieldbutton = (
                <p className="control">
                  <a className={"button" + color} onClick={this.expandedItemSwitch(col)}>
                    {isexpanded ? "折叠" : "展开"}
                  </a>
                </p>
              );
            }
            return (
              <div className={"field" + (addons ? " has-addons" : "")} key={key}>
                {fieldbutton}
                <p className="control is-expanded">{inputview}</p>
                {rightbutton}
              </div>
            );
          });
        });
      }
      let submit_button_color = "is-primary";
      if (Object.values(conflict).filter(v => v).length > 0) {
        submit_button_color = "is-warning";
      }
      let sync_button_state = "is-white";
      if (this.state.sync_state === "loading") {
        sync_button_state = "is-loading is-dark";
      }
      if (this.state.sync_state === "faild") {
        sync_button_state = "is-danger";
      }

      return (
        <div>
          <TabBar kind="options" id={this.props.match.params.id} />
          <div className="field">
            <label className="label">用户名</label>
            <div className="control">
              <input
                className={"input" + (this.state.email ? " is-loading" : "")}
                type="text"
                value={this.state.name || ""}
                onChange={e => this.setState({ name: e.target.value })}
                placeholder={"用户名"}
              />
            </div>
          </div>
          <div className="field">
            <label className="label">E-Mail</label>
            <div className="control">
              <input
                className={"input" + (this.state.email ? " is-loading" : "")}
                type="email"
                value={this.state.email || ""}
                onChange={e => this.setState({ email: e.target.value })}
                placeholder={"your@email.org"}
              />
            </div>
          </div>
          <div className="field">
            <label className="label">远程密码</label>
            <div className="control">
              <input
                className={"input" + (this.state.password ? " is-loading" : "")}
                type="password"
                value={this.state.password || ""}
                onChange={e => this.setState({ password: e.target.value })}
                placeholder={"在此输入远程密码"}
              />
            </div>
          </div>
          <div className="field">
            <label className="label">远程git地址</label>
            <div className="control">
              <input
                className={"input" + (this.state.git ? " is-loading" : "")}
                type="url"
                value={this.state.url || ""}
                onChange={e => this.setState({ url: e.target.value })}
                placeholder={"例如：https://github.com/hjiayz/write-it.git"}
              />
            </div>
          </div>
          <label className="label">模板</label>
          {box}
          <button className={`button ${submit_button_color}`} onClick={this.onSubmit}>
            提交配置
          </button>
          <button className={`button ${sync_button_state}`} onClick={this.onPullAndPush}>
            远程同步
          </button>
        </div>
      );
    }
  };
};
let View = fs => {
  return class extends Component {
    constructor(props) {
      super(props);
      this.state = {};
    }
    componentDidMount() {
      let dir = `/${this.props.match.params.id}`;
      let file = `data.yaml`;
      let path = `${dir}/${file}`;
      fs.readFile(path, (err, buffer) => {
        if (!!err) {
          this.setState({ schema: [[""]] });
        } else {
          let data = yaml.load(buffer.toString());
          this.setState({ data: data });
        }
      });
    }
    render() {
      return (
        <div>
          <TabBar kind="view" id={this.props.match.params.id} />
          {(this.state.data || []).map((item, id) => {
            let body = null;
            let entries = Object.entries(item);
            if (entries.length > 0) {
              body = (
                <div className="message-body">
                  {entries.map(([key, value], id) => {
                    return (
                      <div className="field" key={id}>
                        <label className="label">{key}</label>
                        <div className="control">
                          <div className="input">{value}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }
            return (
              <div className="message is-success" key={id}>
                <div className="message-header">
                  <p>行:{id}</p>
                </div>
                {body}
              </div>
            );
          })}
        </div>
      );
    }
  };
};
class App extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }
  componentDidMount() {
    BrowserFS.configure(
      {
        fs: "IndexedDB",
        options: {}
      },
      e => {
        if (e) {
          throw e;
        }
        var fs = BrowserFS.BFSRequire("fs");
        this.setState({ fs: fs });
      }
    );
  }
  render() {
    if (!this.state.fs) return null;
    return (
      <div className="main">
        <Router>
          <div>
            <Route exact path={root + "/"} component={Home(this.state.fs)} />
            <Route path={root + "/new"} component={NewProject(this.state.fs)} />
            <Route path={root + "/project/:id"} component={Project(this.state.fs)} />
            <Route path={root + "/options/:id"} component={Options(this.state.fs)} />
            <Route path={root + "/View/:id"} component={View(this.state.fs)} />
          </div>
        </Router>
      </div>
    );
  }
}

export default App;
